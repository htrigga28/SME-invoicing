import { apiGet, apiRequest } from "@/lib/api";

import type {
  Customer,
  CustomerDetailResponse,
  CustomerFormInput,
  CustomerListStatus,
  Pagination
} from "./types";

type ListCustomersInput = {
  search?: string;
  status?: CustomerListStatus;
  page?: number;
  limit?: number;
};

export function listCustomers(accessToken: string, input: ListCustomersInput = {}) {
  const params = new URLSearchParams();

  if (input.search) params.set("search", input.search);
  if (input.status) params.set("status", input.status);
  if (input.page) params.set("page", String(input.page));
  if (input.limit) params.set("limit", String(input.limit));

  const query = params.toString();
  return apiGet<{ customers: Customer[]; pagination: Pagination }>(
    `/customers${query ? `?${query}` : ""}`,
    { accessToken }
  );
}

export function getCustomer(accessToken: string, customerId: string) {
  return apiGet<CustomerDetailResponse>(`/customers/${encodeURIComponent(customerId)}`, {
    accessToken
  });
}

export function createCustomer(accessToken: string, input: CustomerFormInput) {
  return apiRequest<{ customer: Customer }>("/customers", {
    method: "POST",
    accessToken,
    body: input
  });
}

export function updateCustomer(accessToken: string, customerId: string, input: CustomerFormInput) {
  return apiRequest<{ customer: Customer }>(`/customers/${encodeURIComponent(customerId)}`, {
    method: "PATCH",
    accessToken,
    body: input
  });
}

export function archiveCustomer(accessToken: string, customerId: string, reason?: string) {
  return apiRequest<{ customer: Customer }>(
    `/customers/${encodeURIComponent(customerId)}/archive`,
    {
      method: "POST",
      accessToken,
      body: { reason }
    }
  );
}
