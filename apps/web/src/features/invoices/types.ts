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
  paidAt: string | null;
  cancelledAt: string | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceDetailResponse = {
  invoice: Invoice;
  lineItems: InvoiceLineItem[];
  statusEvents: InvoiceStatusEvent[];
  financialSummary: FinancialSummary;
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
  notes: string;
  discountNaira: string;
  taxNaira: string;
  lineItems: InvoiceFormLineItem[];
};

export type InvoiceMutationPayload = {
  customerId: string;
  issueDate: string;
  dueDate: string;
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
