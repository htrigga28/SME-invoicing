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
import { Button, LinkButton } from "@/components/ui/button";
import { MetricCard, SectionCard } from "@/components/ui/card";
import {
  DataTable,
  DataTableContainer,
  MobileDataCard,
  Pagination as DataPagination,
  TableHeaderCell
} from "@/components/ui/data-table";
import { EmptyState, LoadingSkeleton } from "@/components/ui/feedback";
import { FilterActions, FilterBar, FilterGrid } from "@/components/ui/filter-bar";
import { DateInput as DateControl, FieldLabel, FormField, Input } from "@/components/ui/form";
import { SegmentedControl } from "@/components/ui/segmented-control";
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

      <SegmentedControl
        label="Payment view"
        onChange={setView}
        options={paymentViews}
        value={view}
      />

      <FilterBar aria-label="Payment filters" onSubmit={handleSearch}>
        <FilterGrid className="md:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_150px_210px_150px_150px_auto]">
          <FormField>
            <FieldLabel>Search</FieldLabel>
            <Input
              className="mt-1"
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Reference, invoice, customer, or email"
              value={searchInput}
            />
          </FormField>
          <FormField>
            <FieldLabel>Status</FieldLabel>
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
          </FormField>
          <FormField>
            <FieldLabel>Reconciliation</FieldLabel>
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
          </FormField>
          <DateInput label="From" onChange={setDateFrom} value={dateFrom} />
          <DateInput label="To" onChange={setDateTo} value={dateTo} />
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
          action={<RetryButton onClick={() => void loadPayments()} />}
          message="Payments could not be loaded."
          tone="error"
        />
      ) : null}

      {state === "ready" && payments.length === 0 ? (
        <EmptyState
          description={
            hasPaginatedRecords
              ? "No payments on this page. Use Previous to return to earlier results."
              : isFiltered
                ? "No payments match your filters."
                : getEmptyStateMessage(view)
          }
          filtered={isFiltered || hasPaginatedRecords}
          title={
            hasPaginatedRecords
              ? "No payments on this page."
              : isFiltered
                ? "No payments match these filters."
                : "No payments yet."
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
    <MetricCard>
      <p className="text-xs font-semibold uppercase text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold text-[var(--text-primary)] tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{helper}</p>
    </MetricCard>
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
    <FormField>
      <FieldLabel>{label}</FieldLabel>
      <DateControl
        className="mt-1"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </FormField>
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
    <DataTableContainer>
      <div className="hidden overflow-x-auto xl:block">
        <DataTable>
          <thead>
            <tr>
              <TableHeaderCell>Reference</TableHeaderCell>
              <TableHeaderCell>Invoice</TableHeaderCell>
              <TableHeaderCell>Customer</TableHeaderCell>
              <TableHeaderCell className="text-right">Amount</TableHeaderCell>
              <TableHeaderCell>State</TableHeaderCell>
              <TableHeaderCell>Reconciliation</TableHeaderCell>
              <TableHeaderCell>Settlement</TableHeaderCell>
              <TableHeaderCell>Date</TableHeaderCell>
              <TableHeaderCell className="text-right">Action</TableHeaderCell>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.map((payment) => (
              <PaymentTableRow key={payment.id} payment={payment} view={view} />
            ))}
          </tbody>
        </DataTable>
      </div>

      <div className="divide-y divide-slate-100 xl:hidden">
        {payments.map((payment) => (
          <PaymentCard key={payment.id} payment={payment} view={view} />
        ))}
      </div>

      <DataPagination
        canGoNext={pagination.page < pagination.totalPages}
        canGoPrevious={pagination.page > 1}
        label={
          <span>
            Page {pagination.page} of {pagination.totalPages} • {pagination.total} payments
          </span>
        }
        onNext={onNext}
        onPrevious={onPrevious}
      />
    </DataTableContainer>
  );
}

function PaymentTableRow({ payment, view }: { payment: PaymentListItem; view: PaymentView }) {
  return (
    <tr
      className={
        payment.isSuperseded && view === "all_attempts" ? "bg-[var(--surface-raised)]" : undefined
      }
    >
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
      <td className="px-4 py-3 text-right font-mono text-slate-700 tabular-nums">
        {formatMoney(payment.amountKobo)}
      </td>
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
        <LinkButton href={`/payments/${payment.id}`} size="sm" variant="outline">
          View
        </LinkButton>
      </td>
    </tr>
  );
}

function PaymentCard({ payment, view }: { payment: PaymentListItem; view: PaymentView }) {
  return (
    <MobileDataCard
      className={
        payment.isSuperseded && view === "all_attempts" ? "bg-[var(--surface-raised)]" : undefined
      }
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
        <span className="font-mono tabular-nums">{formatMoney(payment.amountKobo)}</span>
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
      <LinkButton href={`/payments/${payment.id}`} size="sm" variant="outline">
        View
      </LinkButton>
    </MobileDataCard>
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

function ReviewEvents({ events }: { events: PaymentReviewEvent[] }) {
  return (
    <SectionCard>
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
                <p className="mt-2 rounded-[var(--radius-control)] border border-[var(--warning-border)] bg-[var(--warning-muted)] p-2 text-[var(--warning)]">
                  {event.errorMessage}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
