import type { AttemptState, PaymentStatus, ReconciliationState } from "@sme-invoicing/shared";

import type { Customer, Pagination } from "@/features/customers/types";
import type { Invoice } from "@/features/invoices/types";

export type PaymentSettlementAccount = {
  provider: string;
  bankName: string;
  accountName: string;
  accountNumberLast4: string;
};

export type SettlementAccountContext = {
  currentStatus: "pending_confirmation" | "active" | "verification_delayed" | "disabled";
  isCurrentActiveAccount: boolean;
  isHistorical: boolean;
} | null;

export type PaymentReviewDetails = {
  currency: string | null;
  expectedAmountKobo: number | null;
  receivedAmountKobo: number | null;
} | null;

export type PaymentEventSummary = {
  id: string;
  eventType: string;
  providerReference: string | null;
  processed: boolean;
  processedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export type PaymentListItem = {
  id: string;
  provider: string;
  providerReference: string;
  status: PaymentStatus;
  attemptState: AttemptState;
  reconciliationState: ReconciliationState;
  isSuperseded: boolean;
  supersededReason: string | null;
  reviewDetails: PaymentReviewDetails;
  reviewReason: string | null;
  currency: string;
  amountKobo: number;
  paidAt: string | null;
  failedAt: string | null;
  abandonedAt: string | null;
  initializedAt: string;
  createdAt: string;
  invoice: Pick<
    Invoice,
    "amountPaidKobo" | "balanceDueKobo" | "id" | "invoiceNumber" | "status" | "totalKobo"
  > | null;
  customer: Pick<Customer, "email" | "id" | "name"> | null;
  settlementAccount: PaymentSettlementAccount | null;
  settlementAccountContext: SettlementAccountContext;
  latestEventSummary: Omit<PaymentEventSummary, "id" | "processedAt" | "providerReference"> | null;
};

export type PaymentListResponse = {
  payments: PaymentListItem[];
  pagination: Pagination;
};

export type PaymentDetailPayment = {
  id: string;
  provider: string;
  providerReference: string;
  status: PaymentStatus;
  attemptState: AttemptState;
  reconciliationState: ReconciliationState;
  isSuperseded: boolean;
  supersededReason: string | null;
  reviewDetails: PaymentReviewDetails;
  reviewReason: string | null;
  currency: string;
  amountKobo: number;
  paidAt: string | null;
  failedAt: string | null;
  abandonedAt: string | null;
  channel: string | null;
  gatewayResponse: string | null;
  initializedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PaymentSummaryResponse = {
  totals: {
    collectedKobo: number;
    pendingKobo: number;
    failedKobo: number;
    abandonedKobo: number;
    refundedKobo: number;
    paymentCount: number;
    successfulCount: number;
    pendingCount: number;
    stalePendingCount: number;
    failedCount: number;
    abandonedCount: number;
    refundedCount: number;
    reviewRequiredCount: number;
    supersededCount: number;
  };
  statusBreakdown: {
    status: PaymentStatus;
    count: number;
    amountKobo: number;
  }[];
  recentPayments: PaymentListItem[];
};

export type PaymentReviewEvent = {
  id: string;
  provider: string;
  providerReference: string | null;
  eventType: string;
  processed: boolean;
  processedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  paymentId: string | null;
  invoiceNumber: string | null;
  customerName: string | null;
};

export type PaymentReviewEventsResponse = {
  events: PaymentReviewEvent[];
  pagination: Pagination;
};

export type PaymentDetailResponse = {
  payment: PaymentDetailPayment;
  invoice: Pick<
    Invoice,
    | "amountPaidKobo"
    | "balanceDueKobo"
    | "dueDate"
    | "id"
    | "invoiceNumber"
    | "issueDate"
    | "status"
    | "totalKobo"
  > | null;
  customer: Pick<Customer, "email" | "id" | "name" | "phone"> | null;
  settlementAccount: PaymentSettlementAccount | null;
  settlementAccountContext: SettlementAccountContext;
  events: PaymentEventSummary[];
  receiptPlaceholder: string;
};
