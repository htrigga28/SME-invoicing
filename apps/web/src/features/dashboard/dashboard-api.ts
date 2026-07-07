import { apiGet } from "@/lib/api";

import type { DashboardOverviewResponse } from "./types";

export type DashboardOverviewInput = {
  dateFrom?: string;
  dateTo?: string;
  granularity?: "auto" | "day" | "month" | "week";
};

export function getDashboardOverview(accessToken: string, input: DashboardOverviewInput = {}) {
  const query = toQueryString(input);
  return apiGet<DashboardOverviewResponse>(`/dashboard/overview${query}`, { accessToken });
}

function toQueryString(input: Record<string, string | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}
