import { apiGet, apiRequest } from "@/lib/api";

import type { RecurringLineItem, RecurringFrequency } from "./types";

export function listRecurring(accessToken: string, status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiGet<{ schedules: unknown[] }>(`/recurring-invoices${query}`, { accessToken });
}

export function getRecurring(accessToken: string, id: string) {
  return apiGet(`/recurring-invoices/${encodeURIComponent(id)}`, { accessToken });
}

export type CreateRecurringInput = {
  name: string;
  customerId: string;
  startDate: string;
  frequency: RecurringFrequency;
  endDate?: string | null;
  dueTermsDays?: number;
  autoSend?: boolean;
  toRecipients?: string[];
  ccRecipients?: string[];
  emailSubject?: string | null;
  customerReference?: string | null;
  notes?: string | null;
  discountKobo?: number;
  taxKobo?: number;
  lineItems: RecurringLineItem[];
};

export function createRecurring(accessToken: string, input: CreateRecurringInput) {
  return apiRequest("/recurring-invoices", { method: "POST", accessToken, body: input });
}

export function pauseRecurring(accessToken: string, id: string) {
  return apiRequest(`/recurring-invoices/${encodeURIComponent(id)}/pause`, { method: "POST", accessToken });
}

export function resumeRecurring(accessToken: string, id: string) {
  return apiRequest(`/recurring-invoices/${encodeURIComponent(id)}/resume`, { method: "POST", accessToken });
}

export function cancelRecurring(accessToken: string, id: string) {
  return apiRequest(`/recurring-invoices/${encodeURIComponent(id)}/cancel`, { method: "POST", accessToken });
}
