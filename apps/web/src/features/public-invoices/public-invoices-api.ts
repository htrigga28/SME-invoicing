import { apiGet, apiRequest } from "@/lib/api";

import type { PublicInvoicePaymentInitialization, PublicInvoiceResponse } from "./types";

export function getPublicInvoice(token: string) {
  return apiGet<PublicInvoiceResponse>(`/public/invoices/${encodeURIComponent(token)}`);
}

export function markPublicInvoiceViewed(token: string) {
  return apiRequest<{ success: true }>(`/public/invoices/${encodeURIComponent(token)}/view`, {
    method: "POST"
  });
}

export function initializePublicInvoicePayment(token: string) {
  return apiRequest<PublicInvoicePaymentInitialization>(
    `/public/invoices/${encodeURIComponent(token)}/pay`,
    {
      method: "POST"
    }
  );
}
