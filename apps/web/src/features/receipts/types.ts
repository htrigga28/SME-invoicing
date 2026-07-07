import type { InvoiceStatus } from "@sme-invoicing/shared";

import type { Pagination } from "@/features/customers/types";

export type ReceiptRefundState = "none" | "partially_refunded" | "refunded";

export type ReceiptRefundSummary = {
  originalAmountKobo: number;
  processedRefundedKobo: number;
  netRetainedKobo: number;
  refundState: ReceiptRefundState;
  hasRefundInProgress: boolean;
};

export type ReceiptListItem = {
  id: string;
  receiptNumber: string;
  currency: string;
  amountKobo: number;
  paymentReference: string;
  paymentProvider: string;
  paidAt: string;
  issuedAt: string;
  invoice: {
    id: string;
    invoiceNumber: string;
    status: InvoiceStatus | null;
    totalKobo: number | null;
    amountPaidKobo: number | null;
    balanceDueKobo: number | null;
  };
  customer: {
    id: string;
    name: string;
    email: string;
  };
  refundSummary: ReceiptRefundSummary;
};

export type ReceiptListResponse = {
  receipts: ReceiptListItem[];
  pagination: Pagination;
};

export type ReceiptDetail = {
  id?: string;
  receiptNumber: string;
  publicUrl?: string;
  currency: string;
  amountKobo: number;
  paymentProvider: string;
  paymentReference: string;
  paymentChannel: string | null;
  paidAt: string;
  issuedAt: string;
  business: {
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  customer: {
    id?: string;
    name: string;
    email: string;
    phone: string | null;
    billingAddress: string | null;
  };
  invoice: {
    id?: string;
    invoiceNumber: string;
    status?: InvoiceStatus | null;
    totalKobo?: number | null;
    amountPaidKobo?: number | null;
    balanceDueKobo?: number | null;
  };
  payment: {
    id?: string;
    status?: string | null;
    provider: string;
    providerReference: string;
  };
  refundSummary: ReceiptRefundSummary;
  refunds?: {
    id: string;
    amountKobo: number;
    currency: string;
    status: "failed" | "needs_attention" | "pending" | "processed" | "processing";
    reason: string;
    createdAt: string;
    processedAt: string | null;
  }[];
};

export type ReceiptDetailResponse = {
  receipt: ReceiptDetail;
};
