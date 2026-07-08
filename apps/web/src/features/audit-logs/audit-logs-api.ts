import { apiGet } from "@/lib/api";

import type { AuditLogDetailResponse, AuditLogListResponse, AuditLogCategory } from "./types";

export type ListAuditLogsInput = {
  action?: string;
  actorUserId?: string;
  category?: AuditLogCategory | "";
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  page?: number;
  resourceType?: string;
  search?: string;
};

export function listAuditLogs(accessToken: string, input: ListAuditLogsInput = {}) {
  return apiGet<AuditLogListResponse>(`/audit-logs${toQueryString(input)}`, { accessToken });
}

export function getAuditLog(accessToken: string, auditLogId: string) {
  return apiGet<AuditLogDetailResponse>(`/audit-logs/${encodeURIComponent(auditLogId)}`, {
    accessToken
  });
}

function toQueryString(input: Record<string, number | string | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}
