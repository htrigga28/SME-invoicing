"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import { INVOICE_STATUSES, type InvoiceStatus } from "@sme-invoicing/shared";

import { AppShell } from "@/components/layout/app-shell";
import { Button, LinkButton } from "@/components/ui/button";
import {
  DataTable,
  DataTableContainer,
  MobileDataCard,
  Pagination as DataPagination,
  TableHeaderCell
} from "@/components/ui/data-table";
import { EmptyState, LoadingSkeleton } from "@/components/ui/feedback";
import { FilterActions, FilterBar, FilterGrid } from "@/components/ui/filter-bar";
import { FieldLabel, FormField, Input } from "@/components/ui/form";
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

      <FilterBar aria-label="Invoice filters" onSubmit={handleSearch}>
        <FilterGrid className="lg:grid-cols-[1fr_180px_220px_auto]">
          <FormField>
            <FieldLabel>Search</FieldLabel>
            <Input
              className="mt-1"
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Invoice number, customer, or email"
              value={searchInput}
            />
          </FormField>
          <FormField>
            <FieldLabel>Status</FieldLabel>
            <Select
              onChange={(event) => setStatus(event.target.value as InvoiceStatus | "")}
              value={status}
              wrapperClassName="mt-1"
            >
              <option value="">All statuses</option>
              {INVOICE_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField>
            <FieldLabel>Customer</FieldLabel>
            <Select
              onChange={(event) => setCustomerId(event.target.value)}
              value={customerId}
              wrapperClassName="mt-1"
            >
              <option value="">All customers</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FilterActions>
            <Button type="submit" variant="outline">
              Apply
            </Button>
          </FilterActions>
        </FilterGrid>
      </FilterBar>

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
                  <TableHeaderCell>Issue</TableHeaderCell>
                  <TableHeaderCell>Due</TableHeaderCell>
                  <TableHeaderCell className="text-right">Total</TableHeaderCell>
                  <TableHeaderCell className="text-right">Balance</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell className="text-right">Actions</TableHeaderCell>
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
                    <td className="px-4 py-3 text-right font-mono text-slate-700 tabular-nums">
                      {formatMoney(invoice.totalKobo)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700 tabular-nums">
                      {formatMoney(invoice.balanceDueKobo)}
                    </td>
                    <td className="px-4 py-3">
                      <InvoiceStatusBadge status={invoice.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <LinkButton href={`/invoices/${invoice.id}`} size="sm" variant="outline">
                        View
                      </LinkButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>

          <div className="divide-y divide-slate-100 lg:hidden">
            {invoices.map((invoice) => (
              <MobileDataCard key={invoice.id}>
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
                  <span className="text-right font-mono tabular-nums">
                    {formatMoney(invoice.balanceDueKobo)} due
                  </span>
                </div>
                <LinkButton href={`/invoices/${invoice.id}`} size="sm" variant="outline">
                  View
                </LinkButton>
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
