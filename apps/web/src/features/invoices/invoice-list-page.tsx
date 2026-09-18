"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import { INVOICE_STATUSES, type InvoiceStatus } from "@sme-invoicing/shared";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableContainer,
  MobileDataCard,
  Pagination as DataPagination,
  TableHeaderCell
} from "@/components/ui/data-table";
import { DataToolbar, DataToolbarActions, DataToolbarFilters, DataToolbarSearch, StatusTabs } from "@/components/ui/data-toolbar";
import { EmptyState, LoadingSkeleton } from "@/components/ui/feedback";
import { Input } from "@/components/ui/form";
import { TableRowActionMenu } from "@/components/ui/menu";
import { Select } from "@/components/ui/select";
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
type StatusTab = "" | "draft" | "overdue" | "paid" | "sent";
type DisplayStatusTab = StatusTab | "__none";

const STATUS_TABS: Array<{ label: string; value: StatusTab }> = [
  { label: "All", value: "" },
  { label: "Draft", value: "draft" },
  { label: "Sent", value: "sent" },
  { label: "Overdue", value: "overdue" },
  { label: "Paid", value: "paid" }
];

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
  const router = useRouter();
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

  const activeTab: DisplayStatusTab =
    status === "draft" || status === "overdue" || status === "paid" || status === "sent"
      ? status
      : status === ""
        ? ""
        : "__none";

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
    <section className="space-y-4">
      <PageHeader
        actions={canManage ? <PrimaryLink href="/invoices/new">New invoice</PrimaryLink> : null}
        description="Create and track customer invoices."
        title="Invoices"
      />

      {error ? <StatusPanel message={error} tone="error" /> : null}

      <StatusTabs<DisplayStatusTab>
        label="Invoice status"
        value={activeTab}
        onChange={(v) => setStatus(v as InvoiceStatus | "")}
        options={STATUS_TABS}
      />

      <DataToolbar>
        <DataToolbarSearch>
          <form onSubmit={handleSearch} role="search" aria-label="Search invoices">
            <Input
              aria-label="Search invoices"
              onChange={(event) => {
                setSearchInput(event.target.value);
                if (event.target.value === "") setSearch("");
              }}
              placeholder="Search invoice, customer, email…"
              value={searchInput}
            />
          </form>
        </DataToolbarSearch>
        <DataToolbarFilters>
          <label className="sr-only" htmlFor="invoice-status-filter">Status</label>
          <Select
            id="invoice-status-filter"
            aria-label="Status"
            onChange={(event) => setStatus(event.target.value as InvoiceStatus | "")}
            value={status}
            wrapperClassName="w-40"
          >
            <option value="">All statuses</option>
            {INVOICE_STATUSES.map((option) => (
              <option key={option} value={option}>
                {option.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
          <label className="sr-only" htmlFor="invoice-customer-filter">Customer</label>
          <Select
            id="invoice-customer-filter"
            aria-label="Customer"
            onChange={(event) => setCustomerId(event.target.value)}
            value={customerId}
            wrapperClassName="w-48"
          >
            <option value="">All customers</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </Select>
        </DataToolbarFilters>
        <DataToolbarActions>
          {isFiltered ? (
            <Button
              onClick={() => {
                setSearch("");
                setSearchInput("");
                setStatus("");
                setCustomerId("");
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              Clear
            </Button>
          ) : null}
        </DataToolbarActions>
      </DataToolbar>

      {state === "loading" ? <LoadingSkeleton rows={5} /> : null}

      {state === "error" ? (
        <StatusPanel
          action={
            <Button onClick={() => void loadInvoices()} size="sm" type="button">
              Retry
            </Button>
          }
          message="Invoice list could not be loaded."
          tone="error"
        />
      ) : null}

      {state === "ready" && invoices.length === 0 ? (
        <EmptyState
          action={
            canManage && !isFiltered ? (
              <PrimaryLink href="/invoices/new">New invoice</PrimaryLink>
            ) : null
          }
          description={
            isFiltered
              ? "Adjust search, status, or customer filters to widen the invoice list."
              : "Create an invoice once you have a customer ready to bill."
          }
          filtered={isFiltered}
          title={isFiltered ? "No invoices match these filters." : "No invoices yet."}
        />
      ) : null}

      {state === "ready" && invoices.length > 0 ? (
        <DataTableContainer>
          <div className="hidden overflow-x-auto lg:block">
            <DataTable>
              <thead>
                <tr>
                  <TableHeaderCell>Invoice</TableHeaderCell>
                  <TableHeaderCell>Customer</TableHeaderCell>
                  <TableHeaderCell>Due</TableHeaderCell>
                  <TableHeaderCell className="text-right">Total</TableHeaderCell>
                  <TableHeaderCell className="text-right">Balance</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell className="w-12"><span className="sr-only">Actions</span></TableHeaderCell>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="cursor-pointer hover:bg-[var(--surface-selected)]"
                    onClick={() => router.push(`/invoices/${invoice.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") router.push(`/invoices/${invoice.id}`);
                    }}
                    tabIndex={0}
                    aria-label={`${invoice.invoiceNumber} ${invoice.customer.name}`}
                  >
                    <td className="px-4 py-3.5">
                      <span className="font-medium text-[var(--text-primary)]">{invoice.invoiceNumber}</span>
                      {invoice.customerReference ? (
                        <p className="mt-0.5 font-mono text-xs text-[var(--text-muted)]">
                          {invoice.customerReference}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">{formatDate(invoice.issueDate)}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-[var(--text-primary)]">{invoice.customer.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{invoice.customer.email}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[var(--text-secondary)]">{formatDate(invoice.dueDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-[var(--text-secondary)]">
                      {formatMoney(invoice.totalKobo)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums">
                      {formatMoney(invoice.balanceDueKobo)}
                    </td>
                    <td className="px-4 py-3.5">
                      <InvoiceStatusBadge status={invoice.status} />
                    </td>
                    <td
                      className="px-2 py-3.5 text-right"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <TableRowActionMenu
                        items={[
                          { label: "View", href: `/invoices/${invoice.id}` },
                          ...(canManage && invoice.status === "draft"
                            ? [{ label: "Edit", href: `/invoices/${invoice.id}/edit` }]
                            : [])
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>

          <div className="divide-y divide-[var(--border-subtle)] lg:hidden">
            {invoices.map((invoice) => (
              <MobileDataCard key={invoice.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link className="font-medium text-[var(--text-primary)]" href={`/invoices/${invoice.id}`}>
                      {invoice.invoiceNumber}
                    </Link>
                    <p className="truncate text-sm text-[var(--text-secondary)]">{invoice.customer.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">Due {formatDate(invoice.dueDate)}</p>
                  </div>
                  <InvoiceStatusBadge status={invoice.status} />
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-[var(--text-muted)]">{formatMoney(invoice.totalKobo)} total</span>
                  <span className="font-semibold tabular-nums">
                    {formatMoney(invoice.balanceDueKobo)} due
                  </span>
                </div>
              </MobileDataCard>
            ))}
          </div>
        </DataTableContainer>
      ) : null}

      {state === "ready" && pagination.totalPages > 1 ? (
        <DataPagination
          canGoNext={pagination.page < pagination.totalPages}
          canGoPrevious={pagination.page > 1}
          label={
            <span>
              Page {pagination.page} of {pagination.totalPages} • {pagination.total} invoices
            </span>
          }
          onNext={() => void loadInvoices(pagination.page + 1)}
          onPrevious={() => void loadInvoices(pagination.page - 1)}
        />
      ) : null}
    </section>
  );
}
