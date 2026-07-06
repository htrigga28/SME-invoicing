"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  PAYMENT_STATUSES,
  RECONCILIATION_STATES,
  PAYMENT_STATUS_LABELS,
  RECONCILIATION_STATE_LABELS,
  type PaymentStatus,
  type ReconciliationState
} from "@sme-invoicing/shared";

import { AppShell } from "@/components/layout/app-shell";
import { Select } from "@/components/ui/select";
import { clearStoredSession } from "@/features/auth/session";
import type { Pagination } from "@/features/customers/types";
import { isApiRequestError } from "@/lib/api";

import {
  getPaymentSummary,
  listPaymentReviewEvents,
  listPayments,
  type ListPaymentsInput
} from "./payments-api";
import {
  DetailLink,
  formatDateTime,
  formatMoney,
  formatSettlementAccount,
  PageHeader,
  AttemptStateBadge,
  ReconciliationBadge,
  RetryButton,
  StatusPanel
} from "./payment-ui";
import type { PaymentListItem, PaymentReviewEvent, PaymentSummaryResponse } from "./types";

type LoadState = "loading" | "ready" | "error";
type PaymentView = "all_attempts" | "reconciliation" | "review_required";

const paymentViews: { label: string; value: PaymentView }[] = [
  { label: "Reconciliation", value: "reconciliation" },
  { label: "All attempts", value: "all_attempts" },
  { label: "Needs review", value: "review_required" }
];

export function PaymentsPage() {
  return <AppShell>{({ accessToken }) => <PaymentsContent accessToken={accessToken} />}</AppShell>;
}

export function PaymentsContent({ accessToken }: { accessToken: string }) {
  const [payments, setPayments] = useState<PaymentListItem[]>([]);
  const [summary, setSummary] = useState<PaymentSummaryResponse | null>(null);
  const [reviewEvents, setReviewEvents] = useState<PaymentReviewEvent[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PaymentStatus | "all">("all");
  const [reconciliationState, setReconciliationState] = useState<ReconciliationState | "">("");
  const [view, setView] = useState<PaymentView>("reconciliation");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  const isFiltered = useMemo(
    () =>
      search.trim().length > 0 ||
      status !== "all" ||
      reconciliationState !== "" ||
      view !== "reconciliation" ||
      dateFrom !== "" ||
      dateTo !== "",
    [dateFrom, dateTo, reconciliationState, search, status, view]
  );
  const hasPaginatedRecords = pagination.total > 0;

  useEffect(() => {
    void loadPayments(1);
  }, [accessToken, search, status, reconciliationState, view, dateFrom, dateTo]);

  async function loadPayments(page = pagination.page) {
    setState("loading");
    setError(null);

    try {
      const input: ListPaymentsInput = {
        ...(search.trim() ? { search: search.trim() } : {}),
        status,
        ...(reconciliationState ? { reconciliationState } : {}),
        view,
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        page,
        limit: pagination.limit
      };
      const [paymentResponse, summaryResponse, reviewResponse] = await Promise.all([
        listPayments(accessToken, input),
        getPaymentSummary(accessToken, {
          ...(dateFrom ? { dateFrom } : {}),
          ...(dateTo ? { dateTo } : {})
        }),
        listPaymentReviewEvents(accessToken, { limit: 5 })
      ]);

      setPayments(paymentResponse.payments);
      setPagination(paymentResponse.pagination);
      setSummary(summaryResponse);
      setReviewEvents(reviewResponse.events);
      setState("ready");
    } catch (loadError) {
      if (isApiRequestError(loadError) && loadError.status === 401) {
        clearStoredSession();
        window.location.assign("/login");
        return;
      }

      setError(loadError instanceof Error ? loadError.message : "Could not load payments.");
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
        description="Track confirmed payments, pending confirmations, and payment attempts that need review."
        title="Payments"
      />

      {error ? <StatusPanel message={error} tone="error" /> : null}

      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard
          label="Collected"
          value={formatMoney(summary?.totals.collectedKobo ?? 0)}
          helper={`${summary?.totals.successfulCount ?? 0} successful`}
        />
        <SummaryCard
          label="Awaiting confirmation"
          value={formatMoney(summary?.totals.pendingKobo ?? 0)}
          helper={`${summary?.totals.pendingCount ?? 0} active pending • ${summary?.totals.stalePendingCount ?? 0} stale`}
        />
        <SummaryCard
          label="Failed/abandoned attempts"
          value={formatMoney(
            (summary?.totals.failedKobo ?? 0) + (summary?.totals.abandonedKobo ?? 0)
          )}
          helper={`${(summary?.totals.failedCount ?? 0) + (summary?.totals.abandonedCount ?? 0)} attempts • ${summary?.totals.supersededCount ?? 0} superseded hidden`}
        />
        <SummaryCard
          label="Review required"
          value={String(summary?.totals.reviewRequiredCount ?? 0)}
          helper="True reconciliation issues"
        />
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-2">
        {paymentViews.map((option) => (
          <button
            className={`rounded-md px-3 py-2 text-sm font-semibold ${
              view === option.value ? "bg-teal-700 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
            key={option.value}
            onClick={() => setView(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <form
          className="grid gap-3 lg:grid-cols-[1fr_150px_210px_150px_150px_auto]"
          onSubmit={handleSearch}
        >
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Search</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Reference, invoice, customer, or email"
              value={searchInput}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Status</span>
            <Select
              onChange={(event) => setStatus(event.target.value as PaymentStatus | "all")}
              value={status}
              wrapperClassName="mt-1"
            >
              <option value="all">All</option>
              {PAYMENT_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {PAYMENT_STATUS_LABELS[option]}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Reconciliation</span>
            <Select
              onChange={(event) =>
                setReconciliationState(event.target.value as ReconciliationState | "")
              }
              value={reconciliationState}
              wrapperClassName="mt-1"
            >
              <option value="">All states</option>
              {RECONCILIATION_STATES.map((option) => (
                <option key={option} value={option}>
                  {RECONCILIATION_STATE_LABELS[option]}
                </option>
              ))}
            </Select>
          </label>
          <DateInput label="From" onChange={setDateFrom} value={dateFrom} />
          <DateInput label="To" onChange={setDateTo} value={dateTo} />
          <button
            className="self-end rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            type="submit"
          >
            Apply
          </button>
        </form>
      </div>

      {state === "loading" ? <StatusPanel message="Loading payments..." /> : null}

      {state === "error" ? (
        <StatusPanel
          action={<RetryButton onClick={() => void loadPayments()} />}
          message="Payments could not be loaded."
          tone="error"
        />
      ) : null}

      {state === "ready" && payments.length === 0 ? (
        <StatusPanel
          message={
            hasPaginatedRecords
              ? "No payments on this page. Use Previous to return to earlier results."
              : isFiltered
                ? "No payments match your filters."
                : getEmptyStateMessage(view)
          }
        />
      ) : null}

      {state === "ready" && (payments.length > 0 || hasPaginatedRecords) ? (
        <PaymentResults
          onNext={() => void loadPayments(pagination.page + 1)}
          onPrevious={() => void loadPayments(pagination.page - 1)}
          pagination={pagination}
          payments={payments}
          view={view}
        />
      ) : null}

      {state === "ready" ? <ReviewEvents events={reviewEvents} /> : null}
    </section>
  );
}

function SummaryCard({ helper, label, value }: { helper: string; label: string; value: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{helper}</p>
    </article>
  );
}

function DateInput({
  label,
  onChange,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
    </label>
  );
}

function getEmptyStateMessage(view: PaymentView) {
  if (view === "all_attempts") {
    return "No payment attempts yet.";
  }

  if (view === "review_required") {
    return "No payment events need review.";
  }

  return "No active reconciliation records.";
}

function PaymentResults({
  onNext,
  onPrevious,
  pagination,
  payments,
  view
}: {
  onNext: () => void;
  onPrevious: () => void;
  pagination: Pagination;
  payments: PaymentListItem[];
  view: PaymentView;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="hidden overflow-x-auto xl:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">State</th>
              <th className="px-4 py-3">Reconciliation</th>
              <th className="px-4 py-3">Settlement</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.map((payment) => (
              <PaymentTableRow key={payment.id} payment={payment} view={view} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-100 xl:hidden">
        {payments.map((payment) => (
          <PaymentCard key={payment.id} payment={payment} view={view} />
        ))}
      </div>

      <PaginationControls onNext={onNext} onPrevious={onPrevious} pagination={pagination} />
    </div>
  );
}

function PaymentTableRow({ payment, view }: { payment: PaymentListItem; view: PaymentView }) {
  return (
    <tr className={payment.isSuperseded && view === "all_attempts" ? "bg-slate-50/70" : undefined}>
      <td className="px-4 py-3">
        <DetailLink href={`/payments/${payment.id}`}>{payment.providerReference}</DetailLink>
      </td>
      <td className="px-4 py-3">
        {payment.invoice ? (
          <Link className="font-medium text-slate-950" href={`/invoices/${payment.invoice.id}`}>
            {payment.invoice.invoiceNumber}
          </Link>
        ) : (
          <span className="text-slate-500">No invoice</span>
        )}
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-slate-950">{payment.customer?.name ?? "Unknown"}</p>
        <p className="text-slate-600">{payment.customer?.email ?? "No email"}</p>
      </td>
      <td className="px-4 py-3 text-slate-700">{formatMoney(payment.amountKobo)}</td>
      <td className="px-4 py-3">
        <AttemptStateBadge state={payment.attemptState} />
        {payment.supersededReason ? (
          <p className="mt-1 max-w-48 text-xs text-slate-500">{payment.supersededReason}</p>
        ) : null}
      </td>
      <td className="px-4 py-3">
        {shouldShowReconciliation(payment) ? (
          <ReconciliationBadge state={payment.reconciliationState} />
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-slate-600">
        {formatSettlementAccount(payment.settlementAccount)}
      </td>
      <td className="px-4 py-3 text-slate-600">
        {formatDateTime(payment.paidAt ?? payment.createdAt)}
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          className="rounded-md border border-slate-300 px-3 py-2 font-medium text-slate-700"
          href={`/payments/${payment.id}`}
        >
          View
        </Link>
      </td>
    </tr>
  );
}

function PaymentCard({ payment, view }: { payment: PaymentListItem; view: PaymentView }) {
  return (
    <article
      className={`space-y-3 p-4 ${payment.isSuperseded && view === "all_attempts" ? "bg-slate-50/70" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <DetailLink href={`/payments/${payment.id}`}>{payment.providerReference}</DetailLink>
          <p className="mt-1 text-sm text-slate-600">
            {payment.invoice?.invoiceNumber ?? "No invoice"} • {payment.customer?.name ?? "Unknown"}
          </p>
        </div>
        <AttemptStateBadge state={payment.attemptState} />
      </div>
      <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
        <span>{formatMoney(payment.amountKobo)}</span>
        <span>{formatSettlementAccount(payment.settlementAccount)}</span>
        <span>{formatDateTime(payment.paidAt ?? payment.createdAt)}</span>
        {shouldShowReconciliation(payment) ? (
          <ReconciliationBadge state={payment.reconciliationState} />
        ) : (
          <span>Reconciliation —</span>
        )}
      </div>
      {payment.supersededReason ? (
        <p className="text-xs text-slate-500">{payment.supersededReason}</p>
      ) : null}
    </article>
  );
}

function shouldShowReconciliation(payment: PaymentListItem) {
  return [
    "matched",
    "overpaid",
    "resolution_in_progress",
    "resolved",
    "review_required",
    "superseded"
  ].includes(payment.reconciliationState);
}

function PaginationControls({
  onNext,
  onPrevious,
  pagination
}: {
  onNext: () => void;
  onPrevious: () => void;
  pagination: Pagination;
}) {
  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
      <span>
        Page {pagination.page} of {pagination.totalPages} • {pagination.total} payments
      </span>
      <div className="flex gap-2">
        <button
          className="rounded-md border border-slate-300 px-3 py-2 font-medium disabled:opacity-50"
          disabled={pagination.page <= 1}
          onClick={onPrevious}
          type="button"
        >
          Previous
        </button>
        <button
          className="rounded-md border border-slate-300 px-3 py-2 font-medium disabled:opacity-50"
          disabled={pagination.page >= pagination.totalPages}
          onClick={onNext}
          type="button"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function ReviewEvents({ events }: { events: PaymentReviewEvent[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Needs review</h2>
          <p className="mt-1 text-sm text-slate-600">
            Safe payment event summaries that need manual inspection.
          </p>
        </div>
      </div>
      {events.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">No payment events currently need review.</p>
      ) : (
        <div className="mt-4 divide-y divide-slate-100">
          {events.map((event) => (
            <article className="py-3 text-sm" key={event.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-slate-950">{event.eventType}</p>
                  <p className="text-slate-600">
                    {event.providerReference ?? "No reference"} •{" "}
                    {event.invoiceNumber ?? "No matched invoice"} •{" "}
                    {event.customerName ?? "No matched customer"}
                  </p>
                </div>
                <span className="text-slate-500">{formatDateTime(event.createdAt)}</span>
              </div>
              {event.errorMessage ? (
                <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-900">
                  {event.errorMessage}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
