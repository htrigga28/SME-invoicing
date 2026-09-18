"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DataTable,
  DataTableContainer,
  MobileDataCard,
  Pagination as DataPagination,
  TableHeaderCell
} from "@/components/ui/data-table";
import {
  DataToolbar,
  DataToolbarActions,
  DataToolbarFilters,
  DataToolbarSearch
} from "@/components/ui/data-toolbar";
import { EmptyState, LoadingSkeleton } from "@/components/ui/feedback";
import { DateInput as DateControl, Input } from "@/components/ui/form";
import { TableRowActionMenu } from "@/components/ui/menu";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { clearStoredSession } from "@/features/auth/session";
import type { Pagination } from "@/features/customers/types";
import { isApiRequestError } from "@/lib/api";
import { cn } from "@/lib/cn";

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

  function clearFilters() {
    setSearch("");
    setSearchInput("");
    setStatus("all");
    setReconciliationState("");
    setDateFrom("");
    setDateTo("");
    setView("reconciliation");
  }

  return (
    <section className="space-y-4">
      <PageHeader
        description="Track confirmed payments, pending confirmations, and payment attempts that need review."
        title="Payments"
      />

      {error ? <StatusPanel message={error} tone="error" /> : null}

      <Card aria-label="Payment summary" className="px-5 py-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-4 lg:divide-x lg:divide-[var(--border-subtle)]">
          <SummaryStat
            label="Collected"
            value={formatMoney(summary?.totals.collectedKobo ?? 0)}
            helper={`${summary?.totals.successfulCount ?? 0} successful`}
          />
          <SummaryStat
            label="Awaiting"
            value={formatMoney(summary?.totals.pendingKobo ?? 0)}
            helper={`${summary?.totals.pendingCount ?? 0} active pending • ${summary?.totals.stalePendingCount ?? 0} stale`}
          />
          <SummaryStat
            label="Failed"
            value={formatMoney(
              (summary?.totals.failedKobo ?? 0) + (summary?.totals.abandonedKobo ?? 0)
            )}
            helper={`${(summary?.totals.failedCount ?? 0) + (summary?.totals.abandonedCount ?? 0)} attempts • ${summary?.totals.supersededCount ?? 0} superseded hidden`}
          />
          <SummaryStat
            label="Needs review"
            value={String(summary?.totals.reviewRequiredCount ?? 0)}
            helper="True reconciliation issues"
          />
        </dl>
      </Card>

      <SegmentedControl
        label="Payment view"
        onChange={setView}
        options={paymentViews}
        value={view}
      />

      <DataToolbar>
        <DataToolbarSearch>
          <form aria-label="Search payments" onSubmit={handleSearch} role="search">
            <Input
              aria-label="Search"
              onChange={(event) => {
                setSearchInput(event.target.value);
                if (event.target.value === "") setSearch("");
              }}
              placeholder="Reference, invoice, customer, or email"
              value={searchInput}
            />
          </form>
        </DataToolbarSearch>
        <DataToolbarFilters>
          <label className="sr-only" htmlFor="payment-status-filter">
            Status
          </label>
          <Select
            aria-label="Status"
            id="payment-status-filter"
            onChange={(event) => setStatus(event.target.value as PaymentStatus | "all")}
            value={status}
            wrapperClassName="w-36"
          >
            <option value="all">All</option>
            {PAYMENT_STATUSES.map((option) => (
              <option key={option} value={option}>
                {PAYMENT_STATUS_LABELS[option]}
              </option>
            ))}
          </Select>
          <label className="sr-only" htmlFor="payment-reconciliation-filter">
            Reconciliation
          </label>
          <Select
            aria-label="Reconciliation"
            id="payment-reconciliation-filter"
            onChange={(event) =>
              setReconciliationState(event.target.value as ReconciliationState | "")
            }
            value={reconciliationState}
            wrapperClassName="w-44"
          >
            <option value="">All states</option>
            {RECONCILIATION_STATES.map((option) => (
              <option key={option} value={option}>
                {RECONCILIATION_STATE_LABELS[option]}
              </option>
            ))}
          </Select>
          <label className="sr-only" htmlFor="payment-date-from">
            From
          </label>
          <DateControl
            aria-label="From"
            className="w-36"
            id="payment-date-from"
            onChange={(event) => setDateFrom(event.target.value)}
            value={dateFrom}
          />
          <label className="sr-only" htmlFor="payment-date-to">
            To
          </label>
          <DateControl
            aria-label="To"
            className="w-36"
            id="payment-date-to"
            onChange={(event) => setDateTo(event.target.value)}
            value={dateTo}
          />
        </DataToolbarFilters>
        <DataToolbarActions>
          {isFiltered ? (
            <Button onClick={clearFilters} size="sm" type="button" variant="ghost">
              Clear
            </Button>
          ) : null}
        </DataToolbarActions>
      </DataToolbar>

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

function SummaryStat({
  helper,
  label,
  value
}: {
  helper: string;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 lg:pl-4 lg:first:pl-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </dt>
      <dd className="mt-1 truncate text-xl font-semibold tabular-nums text-[var(--text-primary)]">
        {value}
      </dd>
      <dd className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{helper}</dd>
    </div>
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
              <TableHeaderCell className="w-12">
                <span className="sr-only">Actions</span>
              </TableHeaderCell>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {payments.map((payment) => (
              <PaymentTableRow key={payment.id} payment={payment} view={view} />
            ))}
          </tbody>
        </DataTable>
      </div>

      <div className="divide-y divide-[var(--border-subtle)] xl:hidden">
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
  const router = useRouter();
  const href = `/payments/${payment.id}`;
  const isReviewView = view === "review_required";

  function openDetail() {
    router.push(href);
  }

  return (
    <tr
      aria-label={`${payment.providerReference} payment`}
      className={cn(
        "cursor-pointer transition duration-150 hover:bg-[var(--surface-selected)]",
        payment.isSuperseded && view === "all_attempts" && "bg-[var(--surface-raised)]"
      )}
      onClick={openDetail}
      onKeyDown={(event) => {
        if (event.key === "Enter") openDetail();
      }}
      tabIndex={0}
    >
      <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[13px]">
        <DetailLink href={href}>{payment.providerReference}</DetailLink>
      </td>
      <td className="whitespace-nowrap px-4 py-3.5" onClick={(event) => event.stopPropagation()}>
        {payment.invoice ? (
          <Link
            className="font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]"
            href={`/invoices/${payment.invoice.id}`}
          >
            {payment.invoice.invoiceNumber}
          </Link>
        ) : (
          <span className="text-[var(--text-muted)]">No invoice</span>
        )}
      </td>
      <td className="px-4 py-3.5">
        <p className="font-medium text-[var(--text-primary)]">{payment.customer?.name ?? "Unknown"}</p>
        <p className="text-xs text-[var(--text-muted)]">{payment.customer?.email ?? "No email"}</p>
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-[var(--text-secondary)]">
        {formatMoney(payment.amountKobo)}
      </td>
      <td className="px-4 py-3.5">
        <AttemptStateBadge state={payment.attemptState} />
        {payment.supersededReason ? (
          <p className="mt-1 max-w-48 text-xs text-[var(--text-muted)]">
            {payment.supersededReason}
          </p>
        ) : null}
        {isReviewView && payment.reviewReason ? (
          <p className="mt-1 max-w-64 text-xs font-medium text-[var(--text-primary)]">
            {payment.reviewReason}
          </p>
        ) : null}
        {isReviewView ? (
          <p className="mt-1 text-xs">
            <DetailLink href={href}>Open detail</DetailLink>
          </p>
        ) : null}
      </td>
      <td className="px-4 py-3.5">
        {shouldShowReconciliation(payment) ? (
          <ReconciliationBadge state={payment.reconciliationState} />
        ) : (
          <span className="text-[var(--text-muted)]">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 text-[var(--text-secondary)]">
        {formatSettlementAccount(payment.settlementAccount)}
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 text-[var(--text-secondary)]">
        {formatDateTime(payment.paidAt ?? payment.createdAt)}
      </td>
      <td
        className="px-2 py-3.5 text-right"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <TableRowActionMenu items={[{ label: "View", href }]} />
      </td>
    </tr>
  );
}

function PaymentCard({ payment, view }: { payment: PaymentListItem; view: PaymentView }) {
  const href = `/payments/${payment.id}`;
  const isReviewView = view === "review_required";

  return (
    <MobileDataCard
      className={
        payment.isSuperseded && view === "all_attempts" ? "bg-[var(--surface-raised)]" : undefined
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="break-all font-mono text-[13px]">
            <DetailLink href={href}>{payment.providerReference}</DetailLink>
          </span>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {payment.invoice?.invoiceNumber ?? "No invoice"} • {payment.customer?.name ?? "Unknown"}
          </p>
        </div>
        <AttemptStateBadge state={payment.attemptState} />
      </div>
      {isReviewView && payment.reviewReason ? (
        <p className="text-sm font-medium text-[var(--text-primary)]">{payment.reviewReason}</p>
      ) : null}
      <div className="grid gap-2 text-sm text-[var(--text-secondary)] sm:grid-cols-2">
        <span className="tabular-nums">{formatMoney(payment.amountKobo)}</span>
        <span>{formatSettlementAccount(payment.settlementAccount)}</span>
        <span>{formatDateTime(payment.paidAt ?? payment.createdAt)}</span>
        {shouldShowReconciliation(payment) ? (
          <ReconciliationBadge state={payment.reconciliationState} />
        ) : (
          <span>Reconciliation —</span>
        )}
      </div>
      {payment.supersededReason ? (
        <p className="text-xs text-[var(--text-muted)]">{payment.supersededReason}</p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <DetailLink href={href}>View details</DetailLink>
        <TableRowActionMenu items={[{ label: "View", href }]} />
      </div>
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
    <section aria-label="Needs review" className="border-t border-[var(--border-subtle)] pt-4">
      <h2 className="text-base font-semibold text-[var(--text-primary)]">Needs review</h2>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Safe payment event summaries that need manual inspection.
      </p>
      {events.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          No payment events currently need review.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--border-subtle)]">
          {events.map((event) => (
            <li className="py-3 text-sm" key={event.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--text-primary)]">
                    {event.errorMessage ?? event.eventType}
                  </p>
                  <p className="mt-0.5 text-[var(--text-muted)]">
                    {event.eventType} • {event.providerReference ?? "No reference"} •{" "}
                    {event.invoiceNumber ?? "No matched invoice"} •{" "}
                    {event.customerName ?? "No matched customer"}
                  </p>
                  {event.paymentId ? (
                    <p className="mt-1 text-xs">
                      <DetailLink href={`/payments/${event.paymentId}`}>Open payment</DetailLink>
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 text-[var(--text-muted)]">
                  {formatDateTime(event.createdAt)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
