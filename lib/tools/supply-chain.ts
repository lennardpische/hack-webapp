import { tool } from "ai";
import { z } from "zod";
import {
  draftCommunication,
  getCarrierEvents,
  getShipmentContext,
  getSlotsForShipment,
  listExceptions,
  resolveDeliveryException,
  rescheduleShipment,
} from "@/lib/supply-chain/store";

const DEMO_TODAY = "2026-05-26";

const shipmentLookupSchema = z.object({
  shipmentId: z.string().optional().describe("Internal shipment ID, e.g. SHP-10482"),
  orderId: z.string().optional().describe("Wayfair order ID, e.g. WF-10482"),
  trackingNumber: z
    .string()
    .optional()
    .describe("Carrier tracking number, e.g. 1Z99910482"),
});

function hasShipmentIdentifier(input: z.infer<typeof shipmentLookupSchema>) {
  return Boolean(input.shipmentId || input.orderId || input.trackingNumber);
}

function normalizeDate(date?: string) {
  if (!date) return undefined;
  return date.toLowerCase() === "today" ? DEMO_TODAY : date;
}

export const getShipment = tool({
  description:
    "Look up a shipment by order ID, tracking number, or internal shipment ID. Returns customer, item, carrier, status, linked exception, carrier events, and audit history.",
  inputSchema: shipmentLookupSchema,
  execute: async (input) => {
    if (!hasShipmentIdentifier(input)) {
      return {
        success: false,
        error: "Provide orderId, trackingNumber, or shipmentId.",
      };
    }

    const context = getShipmentContext(input);

    if (!context) {
      return {
        success: false,
        error: "Shipment not found.",
      };
    }

    return {
      success: true,
      data: {
        ...context,
        carrierEvents: getCarrierEvents(context.shipment, context.exception),
      },
    };
  },
});

export const listDeliveryExceptions = tool({
  description:
    "List delivery exceptions and prioritize open supply-chain issues. Use date=today for today's demo exceptions.",
  inputSchema: z.object({
    status: z
      .enum(["open", "in_progress", "resolved", "all"])
      .optional()
      .describe("Exception status filter. Defaults to open."),
    severity: z
      .enum(["low", "medium", "high", "critical"])
      .optional()
      .describe("Severity filter."),
    region: z.string().optional().describe("Region filter, e.g. Mountain or Northeast."),
    date: z
      .string()
      .optional()
      .describe("ISO date YYYY-MM-DD or today. Filters exception creation date."),
    limit: z.number().min(1).max(20).optional(),
  }),
  execute: async ({ status, severity, region, date, limit }) => {
    const rows = listExceptions({
      status,
      severity,
      region,
      date: normalizeDate(date),
      limit,
    });

    return {
      success: true,
      count: rows.length,
      data: rows.map(({ exception, shipment }) => ({
        exception,
        shipment: shipment
          ? {
              id: shipment.id,
              orderId: shipment.orderId,
              trackingNumber: shipment.trackingNumber,
              carrier: shipment.carrier,
              status: shipment.status,
              itemSummary: shipment.itemSummary,
              destination: shipment.destination,
              promisedWindow: shipment.promisedWindow,
              currentWindow: shipment.currentWindow,
            }
          : undefined,
        priority:
          exception.severity === "critical"
            ? "Handle immediately"
            : exception.severity === "high"
              ? "Handle today"
              : "Monitor and recover",
      })),
    };
  },
});

export const getCarrierUpdate = tool({
  description:
    "Get the latest mock carrier scan and notes for a shipment. Use this instead of web search for delivery exception diagnosis.",
  inputSchema: shipmentLookupSchema,
  execute: async (input) => {
    if (!hasShipmentIdentifier(input)) {
      return {
        success: false,
        error: "Provide orderId, trackingNumber, or shipmentId.",
      };
    }

    const context = getShipmentContext(input);

    if (!context) {
      return {
        success: false,
        error: "Shipment not found.",
      };
    }

    return {
      success: true,
      data: {
        shipmentId: context.shipment.id,
        carrier: context.shipment.carrier,
        events: getCarrierEvents(context.shipment, context.exception),
      },
    };
  },
});

export const getRescheduleSlots = tool({
  description:
    "Return valid reschedule slots for a shipment. The agent must use one of these slotId values when calling rescheduleDelivery.",
  inputSchema: shipmentLookupSchema.extend({
    exceptionId: z.string().optional().describe("Linked exception ID, if known."),
  }),
  execute: async (input) => {
    if (!hasShipmentIdentifier(input)) {
      return {
        success: false,
        error: "Provide orderId, trackingNumber, or shipmentId.",
      };
    }

    const context = getShipmentContext(input);

    if (!context) {
      return {
        success: false,
        error: "Shipment not found.",
      };
    }

    if (context.shipment.status === "delivered") {
      return {
        success: false,
        error: "Delivered shipments cannot be rescheduled.",
        data: {
          shipment: context.shipment,
        },
      };
    }

    const slots = getSlotsForShipment(context.shipment);

    return {
      success: true,
      data: {
        shipment: context.shipment,
        exception: context.exception,
        slots,
      },
    };
  },
});

export const rescheduleDelivery = tool({
  description:
    "Commit a shipment to a valid reschedule slot. Only call after the user asks to fix/reschedule/go ahead or explicitly approves a slot.",
  inputSchema: shipmentLookupSchema.extend({
    exceptionId: z.string().optional().describe("Exception ID to link to the update."),
    slotId: z
      .string()
      .describe("A valid slotId returned by getRescheduleSlots, e.g. SLOT-SHP-10482-EARLY."),
    notes: z.string().optional().describe("Short internal note explaining the action."),
  }),
  execute: async (input) => {
    if (!hasShipmentIdentifier(input)) {
      return {
        success: false,
        error: "Provide orderId, trackingNumber, or shipmentId.",
      };
    }

    return rescheduleShipment(input);
  },
});

export const resolveException = tool({
  description:
    "Close a delivery exception after the recovery action is complete or customer communication is drafted.",
  inputSchema: shipmentLookupSchema.extend({
    exceptionId: z.string().optional().describe("Exception ID to resolve."),
    resolution: z
      .string()
      .describe("Concise resolution summary, e.g. Rescheduled to earliest recovery slot."),
    notes: z.string().optional().describe("Internal notes for audit history."),
  }),
  execute: async (input) => {
    return resolveDeliveryException(input);
  },
});

export const draftCustomerCommunication = tool({
  description:
    "Draft customer-facing delivery exception communication. Does not send. Returns email or SMS copy plus 1-3 customer options.",
  inputSchema: shipmentLookupSchema.extend({
    exceptionId: z.string().optional().describe("Linked exception ID, if known."),
    channel: z.enum(["email", "sms"]).optional().describe("Draft channel."),
    selectedSlotId: z
      .string()
      .optional()
      .describe("Preferred slot ID from getRescheduleSlots or rescheduleDelivery."),
    includeAlternatives: z
      .boolean()
      .optional()
      .describe("Include multiple customer options when true."),
    tone: z.enum(["concise", "empathetic"]).optional(),
  }),
  execute: async (input) => {
    if (!hasShipmentIdentifier(input)) {
      return {
        success: false,
        error: "Provide orderId, trackingNumber, or shipmentId.",
      };
    }

    return draftCommunication(input);
  },
});

export const readOnlySupplyChainTools = {
  getShipment,
  listDeliveryExceptions,
};

export const supplyChainAgentTools = {
  getShipment,
  listDeliveryExceptions,
  getCarrierUpdate,
  getRescheduleSlots,
  rescheduleDelivery,
  resolveException,
  draftCustomerCommunication,
};
