import exceptionsFixture from "@/lib/data/exceptions.json";
import shipmentsFixture from "@/lib/data/shipments.json";
import type {
  AuditLogEntry,
  CommunicationChannel,
  CustomerCommunication,
  CustomerOption,
  DeliveryException,
  ExceptionStatus,
  RescheduleSlot,
  Severity,
  Shipment,
  ShipmentWithException,
} from "@/lib/supply-chain/types";

type StoreState = {
  shipments: Shipment[];
  exceptions: DeliveryException[];
  auditLog: AuditLogEntry[];
};

type ListExceptionFilters = {
  status?: ExceptionStatus | "all";
  severity?: Severity;
  region?: string;
  date?: string;
  limit?: number;
};

type MutationResult<T> =
  | { success: true; data: T; auditLog: AuditLogEntry[] }
  | { success: false; error: string; auditLog: AuditLogEntry[] };

const state: StoreState = {
  shipments: structuredClone(shipmentsFixture) as Shipment[],
  exceptions: structuredClone(exceptionsFixture) as DeliveryException[],
  auditLog: [
    {
      id: "AUD-BOOT",
      timestamp: new Date().toISOString(),
      action: "load_fixtures",
      actor: "system",
      details: "Loaded delivery exception demo fixtures into memory.",
    },
  ],
};

function newAuditEntry(
  action: string,
  details: string,
  shipmentId?: string,
  exceptionId?: string,
): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: `AUD-${Date.now()}-${state.auditLog.length + 1}`,
    timestamp: new Date().toISOString(),
    action,
    actor: "agent",
    shipmentId,
    exceptionId,
    details,
  };
  state.auditLog.push(entry);
  return entry;
}

function normalize(value?: string) {
  return value?.trim().toLowerCase();
}

function getShipmentException(shipmentId: string) {
  return state.exceptions
    .filter((item) => item.shipmentId === shipmentId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

function auditFor(shipmentId?: string, exceptionId?: string) {
  if (!shipmentId && !exceptionId) {
    return state.auditLog;
  }

  return state.auditLog.filter(
    (entry) =>
      (shipmentId ? entry.shipmentId === shipmentId : false) ||
      (exceptionId ? entry.exceptionId === exceptionId : false),
  );
}

export function findShipment(input: {
  shipmentId?: string;
  orderId?: string;
  trackingNumber?: string;
}): Shipment | undefined {
  const shipmentId = normalize(input.shipmentId);
  const orderId = normalize(input.orderId);
  const trackingNumber = normalize(input.trackingNumber);

  return state.shipments.find(
    (shipment) =>
      normalize(shipment.id) === shipmentId ||
      normalize(shipment.orderId) === orderId ||
      normalize(shipment.trackingNumber) === trackingNumber,
  );
}

export function getShipmentContext(input: {
  shipmentId?: string;
  orderId?: string;
  trackingNumber?: string;
}): ShipmentWithException | undefined {
  const shipment = findShipment(input);

  if (!shipment) {
    return undefined;
  }

  const exception = getShipmentException(shipment.id);
  return {
    shipment,
    exception,
    auditLog: auditFor(shipment.id, exception?.id),
  };
}

export function listExceptions(filters: ListExceptionFilters = {}) {
  const status = filters.status ?? "open";
  const region = normalize(filters.region);
  const date = filters.date?.trim();
  const limit = filters.limit ?? 20;

  const matches = state.exceptions
    .filter((exception) => status === "all" || exception.status === status)
    .filter((exception) => !filters.severity || exception.severity === filters.severity)
    .filter((exception) => !region || normalize(exception.region)?.includes(region))
    .filter((exception) => !date || exception.createdAt.startsWith(date))
    .map((exception) => ({
      exception,
      shipment: state.shipments.find((shipment) => shipment.id === exception.shipmentId),
    }))
    .filter((record) => record.shipment)
    .sort((a, b) => severityRank(b.exception.severity) - severityRank(a.exception.severity))
    .slice(0, limit);

  return matches;
}

function severityRank(severity: Severity) {
  switch (severity) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
  }
}

export function getCarrierEvents(shipment: Shipment, exception?: DeliveryException) {
  const base = [
    {
      timestamp: "2026-05-25T21:10:00.000Z",
      source: shipment.carrier,
      event: "Freight scanned at origin terminal",
    },
    {
      timestamp: "2026-05-26T08:15:00.000Z",
      source: shipment.carrier,
      event: `Shipment assigned to ${shipment.fulfillmentCenter}`,
    },
  ];

  if (!exception) {
    return [
      ...base,
      {
        timestamp: "2026-05-26T13:00:00.000Z",
        source: shipment.carrier,
        event: "No exception scans on file.",
      },
    ];
  }

  return [
    ...base,
    {
      timestamp: exception.createdAt,
      source: shipment.carrier,
      event: exception.carrierNotes,
    },
    {
      timestamp: exception.updatedAt,
      source: "Wayfair Ops",
      event: exception.recommendedAction,
    },
  ];
}

export function getSlotsForShipment(shipment: Shipment): RescheduleSlot[] {
  if (shipment.status === "delivered") {
    return [];
  }

  const whiteGlove = shipment.requiresWhiteGlove;
  const localCarrier = whiteGlove ? "RXO White Glove" : shipment.carrier;
  const partnerCarrier = whiteGlove ? "J.B. Hunt Final Mile" : "Regional LTL Partner";
  const serviceLevel = shipment.serviceLevel;
  const tomorrowDate = "2026-05-27";
  const nextDayDate = "2026-05-28";
  const weekendDate = "2026-05-30";
  const timezone = timezoneForRegion(shipment.destination.region);

  return [
    {
      slotId: `SLOT-${shipment.id}-EARLY`,
      shipmentId: shipment.id,
      carrier: partnerCarrier,
      window: `${tomorrowDate} 08:00-12:00 ${timezone}`,
      label: "Earliest recovery",
      description: whiteGlove
        ? "Partner two-person white-glove crew with room-of-choice placement."
        : "Local terminal reattempt on the earliest available morning route.",
      serviceLevel,
      fee: whiteGlove ? 49 : 0,
      confidence: whiteGlove ? 0.82 : 0.88,
      tradeoff: whiteGlove
        ? "Fastest customer recovery, but uses partner capacity and a waived fee."
        : "Fastest delivery with normal terminal reattempt risk.",
    },
    {
      slotId: `SLOT-${shipment.id}-STD`,
      shipmentId: shipment.id,
      carrier: localCarrier,
      window: `${nextDayDate} 13:00-17:00 ${timezone}`,
      label: "Balanced option",
      description: "Uses the current carrier's confirmed capacity with lower execution risk.",
      serviceLevel,
      fee: 0,
      confidence: 0.93,
      tradeoff: "One day slower than the earliest slot, but highest confidence.",
    },
    {
      slotId: `SLOT-${shipment.id}-WEEKEND`,
      shipmentId: shipment.id,
      carrier: partnerCarrier,
      window: `${weekendDate} 10:00-14:00 ${timezone}`,
      label: "Customer-friendly weekend",
      description: "Weekend appointment for customers who cannot accept weekday delivery.",
      serviceLevel,
      fee: whiteGlove ? 79 : 29,
      confidence: 0.78,
      tradeoff: "Convenient for the customer but later and more expensive.",
    },
  ];
}

function timezoneForRegion(region: string) {
  if (region === "Mountain") return "MDT";
  if (region === "Pacific Northwest") return "PDT";
  if (region === "Midwest" || region === "Texas") return "CDT";
  if (region === "Southwest") return "MST";
  return "EDT";
}

export function rescheduleShipment(input: {
  shipmentId?: string;
  orderId?: string;
  trackingNumber?: string;
  exceptionId?: string;
  slotId: string;
  notes?: string;
}): MutationResult<{
  shipment: Shipment;
  exception?: DeliveryException;
  selectedSlot: RescheduleSlot;
}> {
  const shipment = findShipment(input);

  if (!shipment) {
    return { success: false, error: "Shipment not found.", auditLog: state.auditLog };
  }

  if (shipment.status === "delivered") {
    return {
      success: false,
      error: "Delivered shipments cannot be rescheduled.",
      auditLog: auditFor(shipment.id),
    };
  }

  if (shipment.scheduledSlotId === input.slotId) {
    return {
      success: false,
      error: "Shipment is already scheduled for that slot.",
      auditLog: auditFor(shipment.id),
    };
  }

  const selectedSlot = getSlotsForShipment(shipment).find(
    (slot) => slot.slotId === input.slotId,
  );

  if (!selectedSlot) {
    return {
      success: false,
      error:
        "Invalid slotId. Call getRescheduleSlots first and choose one of the returned slot IDs.",
      auditLog: auditFor(shipment.id),
    };
  }

  const exception =
    state.exceptions.find((item) => item.id === input.exceptionId) ??
    getShipmentException(shipment.id);

  shipment.status = "rescheduled";
  shipment.currentWindow = selectedSlot.window;
  shipment.scheduledSlotId = selectedSlot.slotId;
  shipment.carrier = selectedSlot.carrier;

  if (exception && exception.status === "open") {
    exception.status = "in_progress";
    exception.updatedAt = new Date().toISOString();
  }

  newAuditEntry(
    "reschedule_delivery",
    `Rescheduled ${shipment.orderId} to ${selectedSlot.window} via ${selectedSlot.carrier}. ${
      input.notes ?? ""
    }`.trim(),
    shipment.id,
    exception?.id,
  );

  return {
    success: true,
    data: {
      shipment,
      exception,
      selectedSlot,
    },
    auditLog: auditFor(shipment.id, exception?.id),
  };
}

export function resolveDeliveryException(input: {
  exceptionId?: string;
  shipmentId?: string;
  orderId?: string;
  trackingNumber?: string;
  resolution: string;
  notes?: string;
}): MutationResult<DeliveryException> {
  const shipment = findShipment(input);
  const exception =
    state.exceptions.find((item) => item.id === input.exceptionId) ??
    (shipment ? getShipmentException(shipment.id) : undefined);

  if (!exception) {
    return { success: false, error: "Exception not found.", auditLog: state.auditLog };
  }

  exception.status = "resolved";
  exception.resolution = input.notes
    ? `${input.resolution} Notes: ${input.notes}`
    : input.resolution;
  exception.resolvedAt = new Date().toISOString();
  exception.updatedAt = exception.resolvedAt;

  newAuditEntry(
    "resolve_exception",
    exception.resolution,
    exception.shipmentId,
    exception.id,
  );

  return {
    success: true,
    data: exception,
    auditLog: auditFor(exception.shipmentId, exception.id),
  };
}

export function draftCommunication(input: {
  shipmentId?: string;
  orderId?: string;
  trackingNumber?: string;
  exceptionId?: string;
  channel?: CommunicationChannel;
  selectedSlotId?: string;
  includeAlternatives?: boolean;
  tone?: "concise" | "empathetic";
}): MutationResult<CustomerCommunication> {
  const shipment = findShipment(input);

  if (!shipment) {
    return { success: false, error: "Shipment not found.", auditLog: state.auditLog };
  }

  const exception =
    state.exceptions.find((item) => item.id === input.exceptionId) ??
    getShipmentException(shipment.id);
  const slots = getSlotsForShipment(shipment);
  const selectedSlot =
    slots.find((slot) => slot.slotId === input.selectedSlotId) ??
    (shipment.scheduledSlotId
      ? slots.find((slot) => slot.slotId === shipment.scheduledSlotId)
      : undefined) ??
    slots[0];
  const includeAlternatives = input.includeAlternatives ?? true;
  const channel = input.channel ?? "email";
  const options: CustomerOption[] = slots
    .slice(0, includeAlternatives ? 3 : 1)
    .map((slot) => ({
      id: slot.slotId,
      label: slot.label,
      description: `${slot.window} via ${slot.carrier}. ${slot.tradeoff}`,
      newDeliveryWindow: slot.window,
      fee: slot.fee,
    }));

  const apology =
    input.tone === "concise"
      ? "We have an update on your Wayfair delivery."
      : "We are sorry your Wayfair delivery did not go as planned, and we are already working on the fastest recovery option.";
  const selectedText = selectedSlot
    ? `The recommended new delivery window is ${selectedSlot.window} with ${selectedSlot.carrier}.`
    : "We are confirming the next available delivery window.";
  const exceptionText = exception
    ? `Reason: ${exception.summary}`
    : "Reason: the carrier reported an exception on this shipment.";

  const subject = `Update on your Wayfair delivery for order ${shipment.orderId}`;
  const emailBody = [
    `Hi ${shipment.customer.name},`,
    "",
    apology,
    exceptionText,
    selectedText,
    "",
    "Please reply with your preferred option, and we will confirm the appointment. If the listed window does not work, we can keep looking for another time.",
    "",
    "Thank you,",
    "Wayfair Delivery Support",
  ].join("\n");

  const smsBody = `${shipment.customer.name}, Wayfair delivery update for ${shipment.orderId}: ${exceptionText} ${selectedText} Reply YES to confirm or OPTIONS for other times.`;

  return {
    success: true,
    data: {
      channel,
      subject: channel === "email" ? subject : undefined,
      body: channel === "email" ? emailBody : smsBody,
      options,
    },
    auditLog: auditFor(shipment.id, exception?.id),
  };
}
