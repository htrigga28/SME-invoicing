import type { PaymentStatus, ReconciliationState } from "@sme-invoicing/shared";

import { apiGet } from "@/lib/api";

import type {
  PaymentDetailResponse,
  PaymentListResponse,
  PaymentReviewEventsResponse,
  PaymentSummaryResponse
} from "./types";

export type ListPaymentsInput = {
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  invoiceId?: string;
  limit?: number;
  page?: number;
  reconciliationState?: ReconciliationState | "";
  search?: string;
  status?: PaymentStatus | "all" | "";
  view?: "all_attempts" | "reconciliation" | "review_required";
};

export function listPayments(accessToken: string, input: ListPaymentsInput = {}) {
  const query = toQueryString(input);
  return apiGet<PaymentListResponse>(`/payments${query}`, { accessToken });
}

export function getPayment(accessToken: string, paymentId: string) {
  return apiGet<PaymentDetailResponse>(`/payments/${encodeURIComponent(paymentId)}`, {
    accessToken
  });
}

export function getPaymentSummary(
  accessToken: string,
  input: Pick<ListPaymentsInput, "dateFrom" | "dateTo"> = {}
) {
  const query = toQueryString(input);
  return apiGet<PaymentSummaryResponse>(`/payments/summary${query}`, { accessToken });
}

export function listPaymentReviewEvents(
  accessToken: string,
  input: { eventType?: string; limit?: number; page?: number; processed?: boolean } = {}
) {
  const query = toQueryString(input);
  return apiGet<PaymentReviewEventsResponse>(`/payments/events/review${query}`, { accessToken });
}

function toQueryString(input: Record<string, boolean | number | string | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}
