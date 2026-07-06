import { apiGet } from "@/lib/api";

import type { ReceiptDetailResponse, ReceiptListResponse, ReceiptRefundState } from "./types";

export type ListReceiptsInput = {
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  invoiceId?: string;
  limit?: number;
  page?: number;
  refundState?: ReceiptRefundState | "all" | "";
  search?: string;
};

export function listReceipts(accessToken: string, input: ListReceiptsInput = {}) {
  const query = toQueryString(input);
  return apiGet<ReceiptListResponse>(`/receipts${query}`, { accessToken });
}

export function getReceipt(accessToken: string, receiptId: string) {
  return apiGet<ReceiptDetailResponse>(`/receipts/${encodeURIComponent(receiptId)}`, {
    accessToken
  });
}

export function getPublicReceipt(token: string) {
  return apiGet<ReceiptDetailResponse>(`/public/receipts/${encodeURIComponent(token)}`);
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
