import type { Membership } from "@/features/auth/types";

export type CustomerStatus = "active" | "archived";

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  billingAddress: string | null;
  status: CustomerStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type CustomerListStatus = CustomerStatus | "all";

export type CustomerFormInput = {
  name: string;
  email: string;
  phone?: string | null;
  billingAddress?: string | null;
};

export type CustomerDetailResponse = {
  customer: Customer;
  invoiceSummary: {
    available: false;
    message: string;
  };
};

export const customerManagerRoles = [
  "owner",
  "admin",
  "accountant"
] as const satisfies readonly Membership["role"][];

export function canManageCustomers(role: Membership["role"]) {
  return customerManagerRoles.includes(role as (typeof customerManagerRoles)[number]);
}
