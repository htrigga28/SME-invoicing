import type { InvoiceStatus } from "@sme-invoicing/shared";
import type { PaymentStatus, ReconciliationState } from "@sme-invoicing/shared";

import type { Customer, Pagination } from "@/features/customers/types";
import type { FinancialSummary } from "@/features/payments/types";

export type InvoiceLineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPriceKobo: number;
  lineTotalKobo: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceStatusEvent = {
  id: string;
  fromStatus: InvoiceStatus | null;
  toStatus: InvoiceStatus;
  reason: string | null;
  metadataRedacted: Record<string, unknown> | null;
  createdAt: string;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  customer: Customer;
  status: InvoiceStatus;
  currency: string;
  issueDate: string;
  dueDate: string;
  customerReference?: string | null;
  notes?: string | null;
  publicToken?: string;
  subtotalKobo: number;
  discountKobo: number;
  taxKobo: number;
  totalKobo: number;
  amountPaidKobo: number;
  balanceDueKobo: number;
  publicAccessEnabled: boolean;
  sentAt: string | null;
  viewedAt?: string | null;
  lastViewedAt?: string | null;
  viewCount?: number;
  paidAt: string | null;
  cancelledAt: string | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DeliveryState =
  | "not_emailed"
  | "sending"
  | "accepted"
  | "delivered"
  | "delayed"
  | "failed"
  | "uncertain"
  | "in_progress"
  | "partially_failed";

export type DeliveryRecipient = {
  id: string;
  email: string;
  recipientType: string;
  status: "pending" | "accepted" | "delivered" | "deferred" | "failed";
  acceptedAt: string | null;
  deliveredAt: string | null;
  deferredAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DeliveryCommunication = {
  id: string;
  subject: string | null;
  toRecipients: string[];
  ccRecipients: string[];
  status:
    | "pending"
    | "accepted"
    | "delivered"
    | "deferred"
    | "failed"
    | "submission_uncertain"
    | "in_progress"
    | "partially_failed";
  acceptedAt: string | null;
  deliveredAt: string | null;
  deferredAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  recipients: DeliveryRecipient[];
  createdAt: string;
  updatedAt: string;
};

export type DeliverySummary = {
  state: DeliveryState;
  message: string;
  attempts: number;
  lastCommunication: DeliveryCommunication | null;
};

export type ViewSummary = {
  viewCount: number;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
} | null;

export type InvoiceActivityItem = {
  id: string;
  type:
    | "invoice_created"
    | "invoice_edited"
    | "invoice_sent"
    | "email_accepted"
    | "email_delivered"
    | "email_deferred"
    | "email_failed"
    | "email_uncertain"
    | "invoice_viewed"
    | "payment_started"
    | "payment_confirmed"
    | "reconciliation_matched"
    | "reconciliation_review"
    | "refund_requested"
    | "refund_processed"
    | "receipt_issued"
    | "invoice_cancelled"
    | "invoice_voided";
  occurredAt: string;
  title: string;
  detail?: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  actor?: { name?: string } | null;
  metadata?: Record<string, string | number | null>;
};

export type InvoiceActivityResponse = {
  activity: InvoiceActivityItem[];
  viewSummary: ViewSummary;
};

export type InvoiceDetailResponse = {
  invoice: Invoice;
  lineItems: InvoiceLineItem[];
  statusEvents: InvoiceStatusEvent[];
  financialSummary: FinancialSummary;
  delivery: DeliverySummary;
  viewSummary: ViewSummary;
  payments: {
    id: string;
    provider: string;
    providerReference: string;
    status: PaymentStatus;
    reconciliationState: ReconciliationState;
    currency: string;
    amountKobo: number;
    paidAt: string | null;
    failedAt: string | null;
    abandonedAt: string | null;
    initializedAt: string;
    createdAt: string;
    settlementAccount: {
      provider: string;
      bankName: string;
      accountName: string;
      accountNumberLast4: string;
      status: "pending_confirmation" | "active" | "verification_delayed" | "disabled";
    } | null;
    receipt: {
      id: string;
      receiptNumber: string;
      issuedAt: string;
    } | null;
  }[];
  publicUrl: string | null;
  paymentSummary:
    | {
        available: true;
        provider: "paystack";
        amountKobo: number;
        currency: "NGN";
        message: string;
      }
    | {
        available: false;
        message: string;
        reason:
          | "invoice_unavailable"
          | "no_outstanding_balance"
          | "payment_setup_disabled"
          | "payment_setup_incomplete"
          | "payment_setup_pending"
          | "payment_unavailable";
      };
};

export type InvoiceListResponse = {
  invoices: Invoice[];
  pagination: Pagination;
};

export type InvoiceFormLineItem = {
  description: string;
  quantity: string;
  unitPriceNaira: string;
};

export type InvoiceFormState = {
  customerId: string;
  issueDate: string;
  dueDate: string;
  customerReference: string;
  notes: string;
  discountNaira: string;
  taxNaira: string;
  lineItems: InvoiceFormLineItem[];
};

export type InvoiceMutationPayload = {
  customerId: string;
  issueDate: string;
  dueDate: string;
  customerReference?: string | null;
  notes?: string | null;
  discountKobo?: number;
  taxKobo?: number;
  lineItems: {
    description: string;
    quantity: number;
    unitPriceKobo: number;
  }[];
};

export const invoiceManagerRoles = ["owner", "admin", "accountant"] as const;

export function canManageInvoices(role: string) {
  return invoiceManagerRoles.includes(role as (typeof invoiceManagerRoles)[number]);
}

export function canCancelOrVoidInvoices(role: string) {
  return role === "owner" || role === "admin";
}
