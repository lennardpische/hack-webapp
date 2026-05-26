export type ExceptionType =
  | "missed_window"
  | "carrier_delay"
  | "address_issue"
  | "damaged"
  | "weather"
  | "failed_attempt";

export type ShipmentStatus =
  | "in_transit"
  | "out_for_delivery"
  | "exception"
  | "rescheduled"
  | "delivered";

export type ExceptionStatus = "open" | "in_progress" | "resolved";

export type Severity = "low" | "medium" | "high" | "critical";

export type ServiceLevel = "parcel" | "ltl" | "white_glove";

export type CommunicationChannel = "email" | "sms";

export type CustomerOption = {
  id: string;
  label: string;
  description: string;
  newDeliveryWindow?: string;
  fee?: number;
};

export type Customer = {
  name: string;
  email: string;
  phone: string;
};

export type Destination = {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  region: string;
};

export type LineItem = {
  sku: string;
  description: string;
  quantity: number;
  cartons: number;
};

export type Shipment = {
  id: string;
  orderId: string;
  trackingNumber: string;
  carrier: string;
  serviceLevel: ServiceLevel;
  status: ShipmentStatus;
  customer: Customer;
  destination: Destination;
  itemSummary: string;
  lineItems: LineItem[];
  supplier: string;
  fulfillmentCenter: string;
  promisedWindow: string;
  currentWindow?: string;
  scheduledSlotId?: string;
  requiresWhiteGlove: boolean;
  isLargeItem: boolean;
  accessNotes?: string;
  notes?: string;
};

export type DeliveryException = {
  id: string;
  shipmentId: string;
  exceptionType: ExceptionType;
  status: ExceptionStatus;
  severity: Severity;
  region: string;
  createdAt: string;
  updatedAt: string;
  summary: string;
  carrierNotes: string;
  customerImpact: string;
  slaRisk: string;
  recommendedAction: string;
  resolution?: string;
  resolvedAt?: string;
};

export type RescheduleSlot = {
  slotId: string;
  shipmentId: string;
  carrier: string;
  window: string;
  label: string;
  description: string;
  serviceLevel: ServiceLevel;
  fee: number;
  confidence: number;
  tradeoff: string;
};

export type CustomerCommunication = {
  channel: CommunicationChannel;
  subject?: string;
  body: string;
  options: CustomerOption[];
};

export type AuditLogEntry = {
  id: string;
  timestamp: string;
  action: string;
  actor: "agent" | "system";
  shipmentId?: string;
  exceptionId?: string;
  details: string;
};

export type ShipmentWithException = {
  shipment: Shipment;
  exception?: DeliveryException;
  auditLog: AuditLogEntry[];
};
