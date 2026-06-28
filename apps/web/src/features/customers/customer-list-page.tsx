"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState, type FormEvent } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { compactPrimaryActionClassName, selectClassName } from "@/components/ui/styles";
import { clearStoredSession } from "@/features/auth/session";
import { isApiRequestError } from "@/lib/api";

import { archiveCustomer, listCustomers } from "./customers-api";
import {
  CustomerStatusBadge,
  formatDate,
  PageHeader,
  PrimaryLink,
  StatusPanel
} from "./customer-ui";
import type { Customer, CustomerListStatus, Pagination } from "./types";
import { canManageCustomers } from "./types";

type LoadState = "loading" | "ready" | "error";

const statusOptions: { label: string; value: CustomerListStatus }[] = [
  { label: "Active", value: "active" },
  { label: "Archived", value: "archived" },
  { label: "All", value: "all" }
];

export function CustomerListPage() {
  return (
    <AppShell>
      {({ accessToken, me }) => (
        <CustomerListContent accessToken={accessToken} role={me.membership.role} />
      )}
    </AppShell>
  );
}

export function CustomerListContent({
  accessToken,
  role
}: {
  accessToken: string;
  role: "owner" | "admin" | "accountant" | "viewer";
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  });
  const [status, setStatus] = useState<CustomerListStatus>("active");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [customerPendingArchive, setCustomerPendingArchive] = useState<Customer | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const canManage = canManageCustomers(role);

  const isFiltered = useMemo(
    () => search.trim().length > 0 || status !== "active",
    [search, status]
  );

  useEffect(() => {
    void loadCustomers(1);
  }, [accessToken, search, status]);

  async function loadCustomers(page = pagination.page) {
    setState("loading");
    setError(null);

    try {
      const searchTerm = search.trim();
      const response = await listCustomers(accessToken, {
        ...(searchTerm ? { search: searchTerm } : {}),
        status,
        page,
        limit: pagination.limit
      });
      setCustomers(response.customers);
      setPagination(response.pagination);
      setState("ready");
    } catch (loadError) {
      if (isApiRequestError(loadError) && loadError.status === 401) {
        clearStoredSession();
        window.location.assign("/login");
        return;
      }

      setError(loadError instanceof Error ? loadError.message : "Could not load customers.");
      setState("error");
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput);
  }

  async function handleArchiveConfirm() {
    if (!customerPendingArchive) {
      return;
    }

    setIsArchiving(true);
    setError(null);
    setSuccess(null);

    try {
      await archiveCustomer(accessToken, customerPendingArchive.id, "Archived from customer list.");
      setSuccess("Customer archived.");
      setCustomerPendingArchive(null);
      await loadCustomers(1);
    } catch (archiveError) {
      setError(
        archiveError instanceof Error ? archiveError.message : "Could not archive customer."
      );
    } finally {
      setIsArchiving(false);
    }
  }

  return (
    <section className="space-y-5">
      <PageHeader
        action={canManage ? <PrimaryLink href="/customers/new">New customer</PrimaryLink> : null}
        description="Manage billing contacts for invoices."
        title="Customers"
      />

      {error ? <StatusPanel message={error} tone="error" /> : null}
      {success ? <StatusPanel message={success} tone="success" /> : null}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_180px_auto]" onSubmit={handleSearch}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Search</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search name, email, or phone"
              value={searchInput}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select
              className={selectClassName}
              onChange={(event) => setStatus(event.target.value as CustomerListStatus)}
              value={status}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="self-end rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            type="submit"
          >
            Apply
          </button>
        </form>
      </div>

      {state === "loading" ? <CustomerListSkeleton /> : null}

      {state === "error" ? (
        <StatusPanel
          action={
            <button
              className={compactPrimaryActionClassName}
              onClick={() => void loadCustomers()}
              type="button"
            >
              Retry
            </button>
          }
          message="Customer list could not be loaded."
          tone="error"
        />
      ) : null}

      {state === "ready" && customers.length === 0 ? (
        <StatusPanel
          action={
            canManage && !isFiltered ? (
              <PrimaryLink href="/customers/new">New customer</PrimaryLink>
            ) : null
          }
          message={isFiltered ? "No customers match your filters." : "Create your first customer."}
        />
      ) : null}

      {state === "ready" && customers.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="px-4 py-3">
                      <Link
                        className="font-medium text-slate-950"
                        href={`/customers/${customer.id}`}
                      >
                        {customer.name}
                      </Link>
                      <p className="text-slate-600">{customer.email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{customer.phone ?? "Not provided"}</td>
                    <td className="px-4 py-3">
                      <CustomerStatusBadge status={customer.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(customer.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Link
                          className="rounded-md border border-slate-300 px-3 py-2 font-medium text-slate-700"
                          href={`/customers/${customer.id}`}
                        >
                          View
                        </Link>
                        {canManage && customer.status === "active" ? (
                          <>
                            <Link
                              className="rounded-md border border-slate-300 px-3 py-2 font-medium text-slate-700"
                              href={`/customers/${customer.id}/edit`}
                            >
                              Edit
                            </Link>
                            <button
                              className="rounded-md border border-red-200 px-3 py-2 font-medium text-red-700"
                              onClick={() => setCustomerPendingArchive(customer)}
                              type="button"
                            >
                              Archive
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 md:hidden">
            {customers.map((customer) => (
              <article className="space-y-3 p-4" key={customer.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link className="font-medium text-slate-950" href={`/customers/${customer.id}`}>
                      {customer.name}
                    </Link>
                    <p className="break-all text-sm text-slate-600">{customer.email}</p>
                  </div>
                  <CustomerStatusBadge status={customer.status} />
                </div>
                <p className="text-sm text-slate-600">{customer.phone ?? "No phone provided"}</p>
                <p className="text-xs text-slate-500">Created {formatDate(customer.createdAt)}</p>
                <div className="flex flex-wrap gap-2 text-sm">
                  <Link
                    className="rounded-md border border-slate-300 px-3 py-2 font-medium"
                    href={`/customers/${customer.id}`}
                  >
                    View
                  </Link>
                  {canManage && customer.status === "active" ? (
                    <Link
                      className="rounded-md border border-slate-300 px-3 py-2 font-medium"
                      href={`/customers/${customer.id}/edit`}
                    >
                      Edit
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {state === "ready" && pagination.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              className="rounded-md border border-slate-300 px-3 py-2 disabled:cursor-not-allowed disabled:text-slate-400"
              disabled={pagination.page <= 1}
              onClick={() => void loadCustomers(pagination.page - 1)}
              type="button"
            >
              Previous
            </button>
            <button
              className="rounded-md border border-slate-300 px-3 py-2 disabled:cursor-not-allowed disabled:text-slate-400"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => void loadCustomers(pagination.page + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        confirmLabel="Archive customer"
        description="Archived customers are read-only and hidden from the active customer list. Historical records remain available."
        destructive
        isLoading={isArchiving}
        loadingLabel="Archiving..."
        onCancel={() => setCustomerPendingArchive(null)}
        onConfirm={() => void handleArchiveConfirm()}
        open={customerPendingArchive !== null}
        title="Archive customer?"
      />
    </section>
  );
}

function CustomerListSkeleton() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">
      Loading customers...
    </div>
  );
}
