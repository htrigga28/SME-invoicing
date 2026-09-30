import { apiGet, apiRequest } from "@/lib/api";

export function getReminderSettings(accessToken: string) {
  return apiGet(`/reminder-settings`, { accessToken });
}

export function putReminderSettings(accessToken: string, input: { enabled: boolean; steps?: unknown[] }) {
  return apiRequest(`/reminder-settings`, { method: "POST", accessToken, body: input });
}

export function createReminderStep(accessToken: string, input: unknown) {
  return apiRequest(`/reminder-settings/steps`, { method: "POST", accessToken, body: input });
}

export function updateReminderStep(accessToken: string, stepId: string, input: unknown) {
  return apiRequest(`/reminder-settings/steps/${encodeURIComponent(stepId)}`, { method: "PATCH", accessToken, body: input });
}

export function deleteReminderStep(accessToken: string, stepId: string) {
  return apiRequest(`/reminder-settings/steps/${encodeURIComponent(stepId)}`, { method: "DELETE", accessToken });
}

export function setInvoiceReminderPreference(accessToken: string, invoiceId: string, enabled: boolean) {
  return apiRequest(`/invoices/${encodeURIComponent(invoiceId)}/reminder-preference`, {
    method: "PATCH",
    accessToken,
    body: { automaticRemindersEnabled: enabled }
  });
}

export function setCustomerReminderPreference(accessToken: string, customerId: string, enabled: boolean) {
  return apiRequest(`/customers/${encodeURIComponent(customerId)}/reminder-preference`, {
    method: "PATCH",
    accessToken,
    body: { automaticRemindersEnabled: enabled }
  });
}

export function scheduleInvoiceSend(accessToken: string, invoiceId: string, input: { scheduledSendDate: string; to?: string[]; cc?: string[]; subject?: string | null }) {
  return apiRequest(`/invoices/${encodeURIComponent(invoiceId)}/schedule-send`, { method: "POST", accessToken, body: input });
}

export function cancelScheduledSend(accessToken: string, invoiceId: string) {
  return apiRequest(`/invoices/${encodeURIComponent(invoiceId)}/schedule-send`, { method: "DELETE", accessToken });
}
