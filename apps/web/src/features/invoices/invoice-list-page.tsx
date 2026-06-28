"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import { INVOICE_STATUSES, type InvoiceStatus } from "@sme-invoicing/shared";

import { AppShell } from "@/components/layout/app-shell";
import { clearStoredSession } from "@/features/auth/session";
import { listCustomers } from "@/features/customers/customers-api";
import type { Customer, Pagination } from "@/features/customers/types";
import { isApiRequestError } from "@/lib/api";

import { listInvoices } from "./invoices-api";
import {
  formatDate,
  formatMoney,
  InvoiceStatusBadge,
  PageHeader,
  PrimaryLink,
  StatusPanel
} from "./invoice-ui";
import type { Invoice } from "./types";
import { canManageInvoices } from "./types";

type LoadState = "loading" | "ready" | "error";

export function InvoiceListPage() {
  return (
    <AppShell>
      {({ accessToken, me }) => (
        <InvoiceListContent accessToken={accessToken} role={me.membership.role} />
      )}
    </AppShell>
  );
}

export function InvoiceListContent({
  accessToken,
  role
}: {
  accessToken: string;
  role: "owner" | "admin" | "accountant" | "viewer";
}) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | "">("");
  const [customerId, setCustomerId] = useState("");
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const canManage = canManageInvoices(role);

  const isFiltered = useMemo(
    () => search.trim().length > 0 || status !== "" || customerId !== "",
    [customerId, search, status]
  );

  useEffect(() => {
    void loadInvoices(1);
  }, [accessToken, customerId, search, status]);

  useEffect(() => {
    listCustomers(accessToken, { status: "active", limit: 100 })
      .then((response) => setCustomers(response.customers))
      .catch(() => undefined);
  }, [accessToken]);

  async function loadInvoices(page = pagination.page) {
    setState("loading");
    setError(null);

    try {
      const response = await listInvoices(accessToken, {
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(status ? { status } : {}),
        ...(customerId ? { customerId } : {}),
        page,
        limit: pagination.limit
      });
      setInvoices(response.invoices);
      setPagination(response.pagination);
      setState("ready");
    } catch (loadError) {
      if (isApiRequestError(loadError) && loadError.status === 401) {
        clearStoredSession();
        window.location.assign("/login");
        return;
      }

      setError(loadError instanceof Error ? loadError.message : "Could not load invoices.");
      setState("error");
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput);
  }

  return (
    <section className="space-y-5">
      <PageHeader
        action={canManage ? <PrimaryLink href="/invoices/new">New invoice</PrimaryLink> : null}
        description="Create and track customer invoices."
        title="Invoices"
      />

      {error ? <StatusPanel message={error} tone="error" /> : null}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <form className="grid gap-3 lg:grid-cols-[1fr_180px_220px_auto]" onSubmit={handleSearch}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Search</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Invoice number, customer, or email"
              value={searchInput}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              onChange={(event) => setStatus(event.target.value as InvoiceStatus | "")}
              value={status}
            >
              <option value="">All statuses</option>
              {INVOICE_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Customer</span>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              onChange={(event) => setCustomerId(event.target.value)}
              value={customerId}
            >
              <option value="">All customers</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
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

      {state === "loading" ? <StatusPanel message="Loading invoices..." /> : null}

      {state === "error" ? (
        <StatusPanel
          action={
            <button
              className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white"
              onClick={() => void loadInvoices()}
              type="button"
            >
              Retry
            </button>
          }
          message="Invoice list could not be loaded."
          tone="error"
        />
      ) : null}

      {state === "ready" && invoices.length === 0 ? (
        <StatusPanel
          action={
            canManage && !isFiltered ? (
              <PrimaryLink href="/invoices/new">New invoice</PrimaryLink>
            ) : null
          }
          message={isFiltered ? "No invoices match your filters." : "Create your first invoice."}
        />
      ) : null}

      {state === "ready" && invoices.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Issue</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Balance</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-4 py-3 font-medium text-slate-950">
                      <Link href={`/invoices/${invoice.id}`}>{invoice.invoiceNumber}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-950">{invoice.customer.name}</p>
                      <p className="text-slate-600">{invoice.customer.email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(invoice.issueDate)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(invoice.dueDate)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatMoney(invoice.totalKobo)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatMoney(invoice.balanceDueKobo)}
                    </td>
                    <td className="px-4 py-3">
                      <InvoiceStatusBadge status={invoice.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        className="rounded-md border border-slate-300 px-3 py-2 font-medium text-slate-700"
                        href={`/invoices/${invoice.id}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 lg:hidden">
            {invoices.map((invoice) => (
              <article className="space-y-3 p-4" key={invoice.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link className="font-medium text-slate-950" href={`/invoices/${invoice.id}`}>
                      {invoice.invoiceNumber}
                    </Link>
                    <p className="text-sm text-slate-600">{invoice.customer.name}</p>
                  </div>
                  <InvoiceStatusBadge status={invoice.status} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm text-slate-600">
                  <span>Due {formatDate(invoice.dueDate)}</span>
                  <span className="text-right">{formatMoney(invoice.balanceDueKobo)} due</span>
                </div>
                <Link
                  className="inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-medium"
                  href={`/invoices/${invoice.id}`}
                >
                  View
                </Link>
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
              onClick={() => void loadInvoices(pagination.page - 1)}
              type="button"
            >
              Previous
            </button>
            <button
              className="rounded-md border border-slate-300 px-3 py-2 disabled:cursor-not-allowed disabled:text-slate-400"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => void loadInvoices(pagination.page + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
