"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { compactPrimaryActionClassName } from "@/components/ui/styles";
import { clearStoredSession } from "@/features/auth/session";
import { formatMoney, InvoiceStatusBadge } from "@/features/invoices/invoice-ui";
import { isApiRequestError } from "@/lib/api";

import { archiveCustomer, getCustomer } from "./customers-api";
import { CustomerStatusBadge, formatDate, PageHeader, StatusPanel } from "./customer-ui";
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
  const router = useRouter();
  const [response, setResponse] = useState<CustomerDetailResponse | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const canManage = canManageCustomers(role);
  const customer = response?.customer;

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
          <button
            className={compactPrimaryActionClassName}
            onClick={() => void loadCustomer()}
            type="button"
          >
            Retry
          </button>
        }
        message={error ?? "Could not load customer."}
        tone="error"
      />
    );
  }

  return (
    <section className="space-y-5">
      <PageHeader
        action={
          <Link
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            href="/customers"
          >
            Back to customers
          </Link>
        }
        description="Customer billing profile and invoice history."
        title={customer.name}
      />

      {error ? <StatusPanel message={error} tone="error" /> : null}
      {success ? <StatusPanel message={success} tone="success" /> : null}

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CustomerStatusBadge status={customer.status} />
              {customer.status === "archived" ? (
                <p className="mt-3 text-sm text-slate-600">
                  Archived on{" "}
                  {customer.archivedAt ? formatDate(customer.archivedAt) : "an unknown date"}.
                </p>
              ) : null}
            </div>
            {canManage && customer.status === "active" ? (
              <div className="flex flex-wrap gap-2">
                <Link
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                  href={`/customers/${customer.id}/edit`}
                >
                  Edit
                </Link>
                <button
                  className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700"
                  onClick={() => setShowArchiveDialog(true)}
                  type="button"
                >
                  Archive
                </button>
              </div>
            ) : null}
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <DetailItem label="Email" value={customer.email} />
            <DetailItem label="Phone" value={customer.phone ?? "Not provided"} />
            <DetailItem label="Billing address" value={customer.billingAddress ?? "Not provided"} />
            <DetailItem label="Created" value={formatDate(customer.createdAt)} />
          </dl>
        </div>

        <InvoiceHistoryPanel response={response} />
      </div>

      {canManage && customer.status === "archived" ? (
        <StatusPanel
          message="Archived customers are readable but cannot be edited in this MVP."
          tone="warning"
        />
      ) : null}

      <button
        className="text-sm font-semibold text-teal-700"
        onClick={() => router.push("/customers")}
        type="button"
      >
        Return to customer list
      </button>

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
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Invoice history</h2>
          <p className="mt-1 text-sm text-slate-600">{response.invoiceSummary.message}</p>
        </div>
        <Link
          className="text-sm font-semibold text-teal-700 hover:text-teal-800"
          href="/invoices"
        >
          View all invoices
        </Link>
      </div>

      <dl className="mt-5 grid gap-4 border-y border-slate-100 py-4 sm:grid-cols-4">
        <InvoiceSummaryMetric
          label="Invoices"
          value={String(response.invoiceSummary.totalInvoices)}
        />
        <InvoiceSummaryMetric
          label="Invoiced"
          value={formatMoney(response.invoiceSummary.totalInvoicedKobo)}
        />
        <InvoiceSummaryMetric
          label="Paid"
          value={formatMoney(response.invoiceSummary.totalPaidKobo)}
        />
        <InvoiceSummaryMetric
          label="Balance due"
          value={formatMoney(response.invoiceSummary.totalBalanceDueKobo)}
        />
      </dl>

      {response.invoices.length === 0 ? (
        <div className="mt-5 rounded-md border border-dashed border-slate-300 p-5 text-sm text-slate-600">
          Create an invoice for this customer and it will appear here.
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Invoice</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Issued</th>
                <th className="px-3 py-2">Due</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Paid</th>
                <th className="px-3 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {response.invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="px-3 py-3 font-medium text-slate-950">
                    <Link
                      className="text-teal-700 hover:text-teal-800"
                      href={`/invoices/${invoice.id}`}
                    >
                      {invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <InvoiceStatusBadge status={invoice.status} />
                  </td>
                  <td className="px-3 py-3 text-slate-600">{formatDate(invoice.issueDate)}</td>
                  <td className="px-3 py-3 text-slate-600">{formatDate(invoice.dueDate)}</td>
                  <td className="px-3 py-3 text-right text-slate-700">
                    {formatMoney(invoice.totalKobo)}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-700">
                    {formatMoney(invoice.amountPaidKobo)}
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-slate-950">
                    {formatMoney(invoice.balanceDueKobo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InvoiceSummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-900">{value}</dd>
    </div>
  );
}
