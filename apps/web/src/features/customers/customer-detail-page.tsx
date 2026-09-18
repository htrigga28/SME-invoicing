"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button, LinkButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DataTable,
  DataTableContainer,
  TableHeaderCell
} from "@/components/ui/data-table";
import { DropdownMenu } from "@/components/ui/menu";
import { clearStoredSession } from "@/features/auth/session";
import { formatMoney, InvoiceStatusBadge } from "@/features/invoices/invoice-ui";
import { isApiRequestError } from "@/lib/api";

import { archiveCustomer, getCustomer } from "./customers-api";
import { CustomerStatusBadge, formatDate, StatusPanel } from "./customer-ui";
import type { CustomerDetailResponse } from "./types";
import { canManageCustomers } from "./types";

type LoadState = "loading" | "ready" | "error";

export function CustomerDetailPage({ customerId }: { customerId: string }) {
  return (
    <AppShell>
      {({ accessToken, me }) => (
        <CustomerDetailContent
          accessToken={accessToken}
          customerId={customerId}
          role={me.membership.role}
        />
      )}
    </AppShell>
  );
}

export function CustomerDetailContent({
  accessToken,
  customerId,
  role
}: {
  accessToken: string;
  customerId: string;
  role: "owner" | "admin" | "accountant" | "viewer";
}) {
  const [response, setResponse] = useState<CustomerDetailResponse | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const canManage = canManageCustomers(role);
  const customer = response?.customer;
  const canArchive = canManage && customer?.status === "active";

  useEffect(() => {
    void loadCustomer();
  }, [accessToken, customerId]);

  async function loadCustomer() {
    setState("loading");
    setError(null);

    try {
      const nextResponse = await getCustomer(accessToken, customerId);
      setResponse(nextResponse);
      setState("ready");
    } catch (loadError) {
      handleAuthError(loadError);
      setError(loadError instanceof Error ? loadError.message : "Could not load customer.");
      setState("error");
    }
  }

  async function handleArchiveConfirm() {
    if (!customer) {
      return;
    }

    setIsArchiving(true);
    setError(null);
    setSuccess(null);

    try {
      const archiveResponse = await archiveCustomer(
        accessToken,
        customer.id,
        "Archived from detail page."
      );
      setResponse((current) =>
        current
          ? {
              ...current,
              customer: archiveResponse.customer
            }
          : current
      );
      setSuccess("Customer archived.");
      setShowArchiveDialog(false);
    } catch (archiveError) {
      handleAuthError(archiveError);
      setError(
        archiveError instanceof Error ? archiveError.message : "Could not archive customer."
      );
    } finally {
      setIsArchiving(false);
    }
  }

  function handleAuthError(apiError: unknown) {
    if (isApiRequestError(apiError) && apiError.status === 401) {
      clearStoredSession();
      window.location.assign("/login");
    }
  }

  if (state === "loading") {
    return <StatusPanel message="Loading customer..." />;
  }

  if (state === "error" || !customer || !response) {
    return (
      <StatusPanel
        action={
          <Button onClick={() => void loadCustomer()} size="sm" type="button">
            Retry
          </Button>
        }
        message={error ?? "Could not load customer."}
        tone="error"
      />
    );
  }

  const contactLine = [customer.email, customer.phone, customer.billingAddress]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  return (
    <section className="space-y-4">
      <Link
        className="inline-flex text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)]"
        href="/customers"
      >
        ← Customers
      </Link>

      {/* Identity header — name / contact / summary + Edit + overflow */}
      <header className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{customer.name}</h1>
              <CustomerStatusBadge status={customer.status} />
            </div>
            <p className="mt-1.5 break-words text-sm text-[var(--text-secondary)]">{contactLine}</p>
            {customer.status === "archived" ? (
              <p className="mt-1.5 text-sm text-[var(--text-muted)]">
                Archived on{" "}
                {customer.archivedAt ? formatDate(customer.archivedAt) : "an unknown date"}.
              </p>
            ) : null}
          </div>
          {canArchive ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <LinkButton href={`/customers/${customer.id}/edit`}>Edit</LinkButton>
              <DropdownMenu
                items={[
                  {
                    label: "Archive customer",
                    destructive: true,
                    onSelect: () => setShowArchiveDialog(true)
                  }
                ]}
                label="More customer actions"
                trigger={<span>•••</span>}
              />
            </div>
          ) : null}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-4">
          <SummaryStat label="Invoiced" value={formatMoney(response.invoiceSummary.totalInvoicedKobo)} />
          <SummaryStat label="Paid" value={formatMoney(response.invoiceSummary.totalPaidKobo)} />
          <SummaryStat
            label="Balance due"
            value={formatMoney(response.invoiceSummary.totalBalanceDueKobo)}
          />
          <SummaryStat label="Invoices" value={String(response.invoiceSummary.totalInvoices)} />
        </dl>
      </header>

      {error ? <StatusPanel message={error} tone="error" /> : null}
      {success ? <StatusPanel message={success} tone="success" /> : null}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <InvoiceHistoryPanel response={response} />

        <aside className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Contact</h2>
          <dl className="mt-3 space-y-3">
            <DetailItem label="Email" value={customer.email} />
            <DetailItem label="Phone" value={customer.phone ?? "Not provided"} />
            <DetailItem label="Billing address" value={customer.billingAddress ?? "Not provided"} />
            <DetailItem label="Customer since" value={formatDate(customer.createdAt)} />
          </dl>
        </aside>
      </div>

      {canManage && customer.status === "archived" ? (
        <StatusPanel
          message="Archived customers are readable but cannot be edited in this MVP."
          tone="warning"
        />
      ) : null}

      <ConfirmDialog
        confirmLabel="Archive customer"
        description="Archived customers are read-only and hidden from the active customer list. Historical records remain available."
        destructive
        isLoading={isArchiving}
        loadingLabel="Archiving..."
        onCancel={() => setShowArchiveDialog(false)}
        onConfirm={() => void handleArchiveConfirm()}
        open={showArchiveDialog}
        title="Archive customer?"
      />
    </section>
  );
}

function InvoiceHistoryPanel({ response }: { response: CustomerDetailResponse }) {
  return (
    <div className="min-w-0 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Invoice history</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {response.invoiceSummary.message}
          </p>
        </div>
        <Link
          className="shrink-0 text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
          href="/invoices"
        >
          View all invoices
        </Link>
      </div>

      {response.invoices.length === 0 ? (
        <div className="mt-5 rounded-[var(--radius-control)] border border-dashed border-[var(--border-strong)] p-5 text-sm text-[var(--text-secondary)]">
          Create an invoice for this customer and it will appear here.
        </div>
      ) : (
        <DataTableContainer className="mt-5">
          <div className="overflow-x-auto">
            <DataTable>
              <thead>
                <tr>
                  <TableHeaderCell>Invoice</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Issued</TableHeaderCell>
                  <TableHeaderCell>Due</TableHeaderCell>
                  <TableHeaderCell className="text-right">Total</TableHeaderCell>
                  <TableHeaderCell className="text-right">Paid</TableHeaderCell>
                  <TableHeaderCell className="text-right">Balance</TableHeaderCell>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {response.invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link
                        className="font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]"
                        href={`/invoices/${invoice.id}`}
                      >
                        {invoice.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <InvoiceStatusBadge status={invoice.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--text-secondary)]">
                      {formatDate(invoice.issueDate)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--text-secondary)]">
                      {formatDate(invoice.dueDate)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[var(--text-secondary)]">
                      {formatMoney(invoice.totalKobo)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[var(--text-secondary)]">
                      {formatMoney(invoice.amountPaidKobo)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">
                      {formatMoney(invoice.balanceDueKobo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
        </DataTableContainer>
      )}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-0.5 truncate text-lg font-semibold tracking-tight tabular-nums">{value}</dd>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm text-[var(--text-primary)]">
        {value}
      </dd>
    </div>
  );
}
