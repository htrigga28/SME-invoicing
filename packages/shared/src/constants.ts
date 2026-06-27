export const ORGANISATION_ROLES = ["owner", "admin", "accountant", "viewer"] as const;

export const INVOICE_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
  "void"
] as const;

export const PAYMENT_STATUSES = [
  "pending",
  "successful",
  "failed",
  "abandoned",
  "refunded"
] as const;

export const DEFAULT_CURRENCY = "NGN";

export type OrganisationRole = (typeof ORGANISATION_ROLES)[number];
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
