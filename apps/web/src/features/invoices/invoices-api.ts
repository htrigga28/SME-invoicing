import type { InvoiceStatus } from "@sme-invoicing/shared";

import { apiGet, apiRequest } from "@/lib/api";

import type {
  InvoiceActivityResponse,
  InvoiceDetailResponse,
  InvoiceListResponse,
  InvoiceMutationPayload
} from "./types";

type ListInvoicesInput = {
  customerId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  issueDateFrom?: string;
  issueDateTo?: string;
  limit?: number;
  page?: number;
  search?: string;
  status?: InvoiceStatus | "";
};

export function listInvoices(accessToken: string, input: ListInvoicesInput = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  const query = params.toString();
  return apiGet<InvoiceListResponse>(`/invoices${query ? `?${query}` : ""}`, { accessToken });
}

export function getInvoice(accessToken: string, invoiceId: string) {
  return apiGet<InvoiceDetailResponse>(`/invoices/${encodeURIComponent(invoiceId)}`, {
    accessToken
  });
}

export function createInvoice(accessToken: string, input: InvoiceMutationPayload) {
  return apiRequest<InvoiceDetailResponse>("/invoices", {
    method: "POST",
    accessToken,
    body: input
  });
}

export function updateInvoice(
  accessToken: string,
  invoiceId: string,
  input: InvoiceMutationPayload
) {
  return apiRequest<InvoiceDetailResponse>(`/invoices/${encodeURIComponent(invoiceId)}`, {
    method: "PATCH",
    accessToken,
    body: input
  });
}

export type SendInvoiceEmailInput = {
  to?: string[];
  cc?: string[];
  subject?: string;
};

export type ResendInvoiceEmailInput = SendInvoiceEmailInput & {
  force?: boolean;
};

export function sendInvoice(
  accessToken: string,
  invoiceId: string,
  input: SendInvoiceEmailInput = {}
) {
  return apiRequest<InvoiceDetailResponse>(`/invoices/${encodeURIComponent(invoiceId)}/send`, {
    method: "POST",
    accessToken,
    body: input
  });
}

export function resendInvoiceEmail(
  accessToken: string,
  invoiceId: string,
  input: ResendInvoiceEmailInput
) {
  return apiRequest<{ delivery: InvoiceDetailResponse["delivery"] }>(
    `/invoices/${encodeURIComponent(invoiceId)}/resend`,
    {
      method: "POST",
      accessToken,
      body: input
    }
  );
}

export function retryInvoiceEmailAttempt(
  accessToken: string,
  invoiceId: string,
  attemptId: string
) {
  return apiRequest<{ delivery: InvoiceDetailResponse["delivery"] }>(
    `/invoices/${encodeURIComponent(invoiceId)}/delivery-attempts/${encodeURIComponent(attemptId)}/retry`,
    { method: "POST", accessToken }
  );
}

export function getInvoiceActivity(accessToken: string, invoiceId: string) {
  return apiGet<InvoiceActivityResponse>(`/invoices/${encodeURIComponent(invoiceId)}/activity`, {
    accessToken
  });
}

export function duplicateInvoice(accessToken: string, invoiceId: string) {
  return apiRequest<InvoiceDetailResponse>(`/invoices/${encodeURIComponent(invoiceId)}/duplicate`, {
    method: "POST",
    accessToken
  });
}

export function cancelInvoice(accessToken: string, invoiceId: string, reason: string) {
  return apiRequest<InvoiceDetailResponse>(`/invoices/${encodeURIComponent(invoiceId)}/cancel`, {
    method: "POST",
    accessToken,
    body: { reason }
  });
}

export function voidInvoice(accessToken: string, invoiceId: string, reason: string) {
  return apiRequest<InvoiceDetailResponse>(`/invoices/${encodeURIComponent(invoiceId)}/void`, {
    method: "POST",
    accessToken,
    body: { reason }
  });
}
