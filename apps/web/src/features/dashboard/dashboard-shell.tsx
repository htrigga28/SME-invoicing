"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ATTEMPT_STATE_LABELS, RECONCILIATION_STATE_LABELS } from "@sme-invoicing/shared";

import { AppShell } from "@/components/layout/app-shell";
import { LinkButton } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { MetadataLabel } from "@/components/ui/typography";
import type { Membership } from "@/features/auth/types";
import { clearStoredSession } from "@/features/auth/session";
import { canManagePaymentSetup } from "@/features/payment-setup/types";
import { isApiRequestError } from "@/lib/api";
import {
  formatDate,
  formatMoney,
  InvoiceStatusBadge,
  PageHeader,
  StatusPanel
} from "@/features/invoices/invoice-ui";

import { CashflowChart } from "./components/cashflow-chart";
import { OutstandingAgingChart } from "./components/outstanding-aging-chart";
import { getDashboardOverview, type DashboardOverviewInput } from "./dashboard-api";
import type { DashboardOverviewResponse } from "./types";

type LoadState = "error" | "loading" | "ready";
type PresetRange = "7" | "30" | "90" | "custom";

export function DashboardShell() {
  return (
    <AppShell>
      {({ accessToken, me }) => (
        <DashboardContent accessToken={accessToken} role={me.membership.role} />
      )}
    </AppShell>
  );
}

function DashboardContent({
  accessToken,
  role
}: {
  accessToken: string;
  role: Membership["role"];
}) {
  const today = useMemo(() => toDateInputValue(new Date()), []);
  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(null);
  const [query, setQuery] = useState<DashboardOverviewInput>({});
  const [selectedRange, setSelectedRange] = useState<PresetRange>("30");
  const [customFrom, setCustomFrom] = useState(addDays(today, -29));
  const [customTo, setCustomTo] = useState(today);
  const [customOpen, setCustomOpen] = useState(false);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [showSignupComplete, setShowSignupComplete] = useState(false);
  const canCreateInvoice = role === "owner" || role === "admin" || role === "accountant";

  useEffect(() => {
    setShowSignupComplete(
      new URLSearchParams(window.location.search).get("onboarding") === "complete"
    );
  }, []);

  useEffect(() => {
    let active = true;

    async function loadOverview() {
      setState("loading");
      setError(null);

      try {
        const response = await getDashboardOverview(accessToken, query);

        if (!active) {
          return;
        }

        setOverview(response);
        setState("ready");
      } catch (loadError) {
        if (!active) {
          return;
        }

        if (isApiRequestError(loadError) && loadError.status === 401) {
          clearStoredSession();
          window.location.assign("/login");
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Could not load dashboard.");
        setState("error");
      }
    }

    void loadOverview();

    return () => {
      active = false;
    };
  }, [accessToken, query]);

  function applyPreset(range: Exclude<PresetRange, "custom">) {
    setSelectedRange(range);
    setCustomOpen(false);

    if (range === "30") {
      setQuery({});
      return;
    }

    setQuery({
      dateFrom: addDays(today, Number(range) * -1 + 1),
      dateTo: today,
      granularity: "auto"
    });
  }

  function applyCustomRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (customFrom > customTo) {
      setError("Date from must be on or before date to.");
      setState("error");
      return;
    }

    setSelectedRange("custom");
    setQuery({
      dateFrom: customFrom,
      dateTo: customTo,
      granularity: "auto"
    });
  }

  const periodLabel = overview
    ? `${formatDate(overview.period.dateFrom)} – ${formatDate(overview.period.dateTo)}`
    : "Selected period";

  return (
    <section className="space-y-5">
      <PageHeader
        description="Outstanding, overdue and collections at a glance."
        title="Overview"
        actions={
          canCreateInvoice ? <LinkButton href="/invoices/new" size="sm">New invoice</LinkButton> : null
        }
      />

      {showSignupComplete ? (
        <Alert tone="success">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-[var(--text-primary)]">Your workspace is ready</p>
              <p className="mt-1">Create your first invoice to start the payment trail.</p>
            </div>
            <LinkButton href="/invoices/new" size="sm">
              Create first invoice
            </LinkButton>
          </div>
        </Alert>
      ) : null}

      {/* Compact period toolbar — Mercury/Stripe style, not a full card */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-xs text-[var(--text-muted)]">
          {periodLabel} · {overview?.period.granularity ?? "day"} buckets
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl<Exclude<PresetRange, "custom">>
            label="Reporting period"
            value={selectedRange === "custom" ? "30" : selectedRange}
            onChange={applyPreset}
            options={[
              { label: "7D", value: "7" },
              { label: "30D", value: "30" },
              { label: "90D", value: "90" }
            ]}
          />
          <button
            onClick={() => setCustomOpen((v) => !v)}
            type="button"
            aria-expanded={customOpen}
            className="inline-flex min-h-9 items-center rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--text-secondary)] transition duration-150 hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
          >
            {selectedRange === "custom" ? `${customFrom} → ${customTo}` : "Custom"}
          </button>
        </div>
      </div>
      {customOpen ? (
        <form
          onSubmit={applyCustomRange}
          className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3 sm:flex-row sm:items-end"
        >
          <label className="block">
            <span className="text-xs font-medium text-[var(--text-secondary)]">From</span>
            <input
              className="mt-1 min-h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface)] px-3 text-sm sm:w-40"
              onChange={(e) => setCustomFrom(e.target.value)}
              type="date"
              value={customFrom}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[var(--text-secondary)]">To</span>
            <input
              className="mt-1 min-h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface)] px-3 text-sm sm:w-40"
              onChange={(e) => setCustomTo(e.target.value)}
              type="date"
              value={customTo}
            />
          </label>
          <button
            type="submit"
            className="inline-flex min-h-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]"
          >
            Apply
          </button>
        </form>
      ) : null}

      {error ? <StatusPanel message={error} tone="error" /> : null}
      {state === "loading" ? <StatusPanel message="Loading dashboard..." /> : null}

      {state === "error" ? (
        <StatusPanel
          action={
            <button
              className="inline-flex min-h-9 items-center rounded-[var(--radius-control)] bg-[var(--accent)] px-3 text-sm font-semibold text-[var(--accent-foreground)]"
              onClick={() => setQuery({ ...query })}
              type="button"
            >
              Retry
            </button>
          }
          message="Dashboard overview could not be loaded."
          tone="error"
        />
      ) : null}

      {state === "ready" && overview ? (
        <>
          {overview.paymentSetup.status === "active" ? (
            <PaymentSetupBanner overview={overview} role={role} />
          ) : null}
          <AttentionRegion overview={overview} role={role} />

          {/* 4 primary metrics only — Outstanding / Overdue / Net collected / Needs attention */}
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key metrics">
            <MetricCard
              label="Current"
              title="Outstanding"
              value={formatMoney(overview.currentPosition.outstandingKobo)}
              detail={`${overview.currentPosition.outstandingInvoiceCount} invoice${
                overview.currentPosition.outstandingInvoiceCount === 1 ? "" : "s"
              } open`}
            />
            <MetricCard
              label="Current"
              title="Overdue"
              value={formatMoney(overview.currentPosition.overdueKobo)}
              tone={overview.currentPosition.overdueInvoiceCount > 0 ? "warning" : "neutral"}
              detail={`${overview.currentPosition.overdueInvoiceCount} overdue`}
            />
            <MetricCard
              label="Selected period"
              title="Net collected"
              value={formatMoney(overview.financialActivity.netCollectedKobo)}
              detail={`${overview.financialActivity.successfulPaymentCount} payments · ${overview.financialActivity.receiptsIssuedCount} receipts`}
            />
            <MetricCard
              label="Current"
              title="Needs attention"
              value={overview.currentPosition.unresolvedReviewCount.toLocaleString("en-NG")}
              tone={overview.currentPosition.unresolvedReviewCount > 0 ? "danger" : "neutral"}
              detail={`${overview.currentPosition.activePendingPaymentCount} pending confirmation`}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card className="p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">Collections</h2>
                <p className="text-xs text-[var(--text-muted)]">{periodLabel}</p>
              </div>
              <div className="mt-3">
                <CashflowChart data={overview.cashflowTrend} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-[var(--border-subtle)] pt-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-[var(--text-muted)]">Gross</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">{formatMoney(overview.financialActivity.grossCollectedKobo)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--text-muted)]">Refunds</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">{formatMoney(overview.financialActivity.processedRefundsKobo)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--text-muted)]">Payments</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">{overview.financialActivity.successfulPaymentCount}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--text-muted)]">Receipts</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">{overview.financialActivity.receiptsIssuedCount}</dd>
                </div>
              </dl>
            </Card>

            <SectionCard>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Aging</h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Outstanding by overdue age</p>
              <div className="mt-3">
                <OutstandingAgingChart aging={overview.outstandingAging} />
              </div>
            </SectionCard>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <RecentActivity overview={overview} />
            <ReviewIssues overview={overview} />
          </section>
        </>
      ) : null}
    </section>
  );
}

type AttentionRegionProps = {
  overview: DashboardOverviewResponse;
  role: Membership["role"];
};

function AttentionRegion({ overview, role }: AttentionRegionProps) {
  const setup = overview.paymentSetup;
  const showSetup = setup.status !== "active";
  const showReview = overview.currentPosition.unresolvedReviewCount > 0;
  const showOverdue = overview.currentPosition.overdueInvoiceCount > 0;
  const showPending = overview.currentPosition.activePendingPaymentCount > 0;

  if (!showSetup && !showReview && !showOverdue && !showPending) {
    return null;
  }

  return (
    <section aria-label="Attention" className="space-y-2">
      {showSetup ? <PaymentSetupBanner overview={overview} role={role} /> : null}
      {showReview ? (
        <AttentionRow
          description={`${overview.currentPosition.unresolvedReviewCount.toLocaleString("en-NG")} payment issue${overview.currentPosition.unresolvedReviewCount === 1 ? "" : "s"} need review.`}
          href="/payments"
          title="Needs review"
          tone="danger"
        />
      ) : null}
      {showOverdue ? (
        <AttentionRow
          description={`${overview.currentPosition.overdueInvoiceCount.toLocaleString("en-NG")} overdue invoice${overview.currentPosition.overdueInvoiceCount === 1 ? "" : "s"} need attention.`}
          href="/invoices"
          title="Overdue"
          tone="warning"
        />
      ) : null}
      {showPending ? (
        <AttentionRow
          description={`${overview.currentPosition.activePendingPaymentCount.toLocaleString("en-NG")} payment${overview.currentPosition.activePendingPaymentCount === 1 ? "" : "s"} awaiting confirmation.`}
          href="/payments"
          title="Pending confirmations"
          tone="info"
        />
      ) : null}
    </section>
  );
}

function AttentionRow({
  description,
  href,
  title,
  tone
}: {
  description: string;
  href: string;
  title: string;
  tone: "danger" | "info" | "warning";
}) {
  const className = {
    danger: "border-[var(--danger-border)] bg-[var(--danger-muted)]",
    info: "border-[var(--border-subtle)] bg-[var(--surface)]",
    warning: "border-[var(--warning-border)] bg-[var(--warning-muted)]"
  }[tone];

  return (
    <div
      className={`flex min-w-0 flex-col gap-3 rounded-[var(--radius-card)] border p-4 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div className="min-w-0">
        <h2 className="font-semibold text-[var(--text-primary)]">{title}</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
      </div>
      <LinkButton className="shrink-0" href={href} size="sm" variant="outline">
        Review
      </LinkButton>
    </div>
  );
}

function PaymentSetupBanner({
  overview,
  role
}: {
  overview: DashboardOverviewResponse;
  role: Membership["role"];
}) {
  const setup = overview.paymentSetup;
  const canManage = canManagePaymentSetup(role);

  if (setup.status === "active") {
    return (
      <Alert tone="success">
        <p className="font-semibold">Online payments active</p>
        <p className="mt-1">
          {setup.bankName} payout account ending {setup.accountNumberLast4}.
        </p>
      </Alert>
    );
  }

  if (setup.status === "verification_delayed") {
    return (
      <Alert tone="warning">
        <p className="font-semibold">Payment Setup verification delayed</p>
        <p className="mt-1">
          Online payments are not active yet. Customers can view invoices while setup is pending.
        </p>
      </Alert>
    );
  }

  const isDisabled = setup.status === "disabled";
  const actionLabel = isDisabled ? "Reactivate payment setup" : "Set up online payments";

  return (
    <Alert tone="warning">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">
            {isDisabled ? "Online payments are disabled" : "Online payments are not configured"}
          </p>
          <p className="mt-1">
            {canManage
              ? "Activate Payment Setup so customers can pay public invoices online."
              : "Payment Setup requires an owner or admin before online invoice payments can start."}
          </p>
        </div>
        {canManage ? (
          <LinkButton href="/settings/payment-setup" size="sm">
            {actionLabel}
          </LinkButton>
        ) : null}
      </div>
    </Alert>
  );
}

function MetricCard({
  detail,
  label,
  title,
  tone = "neutral",
  value
}: {
  detail?: string;
  label: string;
  title: string;
  tone?: "danger" | "neutral" | "warning";
  value: string;
}) {
  const toneClassName = {
    danger: "text-[var(--danger)]",
    neutral: "text-[var(--text-primary)]",
    warning: "text-[var(--warning)]"
  }[tone];

  return (
    <Card className="p-4">
      <MetadataLabel>{label}</MetadataLabel>
      <h2 className="mt-1.5 text-sm font-medium text-[var(--text-secondary)]">{title}</h2>
      <p className={`mt-2 text-[28px] font-semibold leading-none tracking-tight tabular-nums ${toneClassName}`}>
        {value}
      </p>
      {detail ? <p className="mt-2 text-xs text-[var(--text-muted)]">{detail}</p> : null}
    </Card>
  );
}

function RecentActivity({ overview }: { overview: DashboardOverviewResponse }) {
  const items: Array<{ key: string; date: string; node: ReactNode }> = [];

  for (const invoice of overview.recentInvoices) {
    items.push({
      key: `inv-${invoice.id}`,
      date: invoice.createdAt,
      node: (
        <li className="flex items-center justify-between gap-3 py-3" key={`inv-${invoice.id}`}>
          <div className="min-w-0">
            <Link className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)]" href={`/invoices/${invoice.id}`}>
              {invoice.invoiceNumber}
            </Link>
            <p className="truncate text-sm text-[var(--text-secondary)]">{invoice.customer.name}</p>
            <p className="text-xs text-[var(--text-muted)]">Due {formatDate(invoice.dueDate)} · Invoice</p>
          </div>
          <div className="shrink-0 text-right">
            <InvoiceStatusBadge status={invoice.status} />
            <p className="mt-2 text-sm font-semibold tabular-nums">{formatMoney(invoice.balanceDueKobo)}</p>
          </div>
        </li>
      )
    });
  }

  for (const payment of overview.recentPayments) {
    items.push({
      key: `pay-${payment.id}`,
      date: payment.paidAt ?? payment.createdAt,
      node: (
        <li className="flex items-center justify-between gap-3 py-3" key={`pay-${payment.id}`}>
          <div className="min-w-0">
            <Link
              className="font-medium text-[var(--text-primary)] [overflow-wrap:anywhere] hover:text-[var(--accent)]"
              href={`/payments/${payment.id}`}
            >
              {payment.providerReference}
            </Link>
            <p className="truncate text-sm text-[var(--text-secondary)]">
              {payment.customer?.name ?? "Unknown customer"} ·{" "}
              {payment.invoice?.invoiceNumber ?? "No invoice"}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {formatDateTime(payment.paidAt ?? payment.createdAt)} · Payment
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold tabular-nums">{formatMoney(payment.amountKobo)}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {ATTEMPT_STATE_LABELS[payment.state]}
            </p>
          </div>
        </li>
      )
    });
  }

  for (const receipt of overview.recentReceipts) {
    items.push({
      key: `rct-${receipt.id}`,
      date: receipt.issuedAt,
      node: (
        <li className="flex items-center justify-between gap-3 py-3" key={`rct-${receipt.id}`}>
          <div className="min-w-0">
            <Link className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)]" href={`/receipts/${receipt.id}`}>
              {receipt.receiptNumber}
            </Link>
            <p className="truncate text-sm text-[var(--text-secondary)]">
              {receipt.customer.name} · {receipt.invoice.invoiceNumber}
            </p>
            <p className="text-xs text-[var(--text-muted)]">{formatDateTime(receipt.issuedAt)} · Receipt</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold tabular-nums">{formatMoney(receipt.amountKobo)}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {receipt.refundSummary.refundState.replaceAll("_", " ")}
            </p>
          </div>
        </li>
      )
    });
  }

  items.sort((a, b) => (a.date < b.date ? 1 : -1));
  const visible = items.slice(0, 8);

  return (
    <SectionCard>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Recent activity</h2>
        <Link href="/invoices" className="text-sm font-semibold text-[var(--accent)] hover:underline">
          View invoices
        </Link>
      </div>
      {visible.length ? (
        <ul className="divide-y divide-[var(--border-subtle)]">{visible.map((i) => i.node)}</ul>
      ) : (
        <p className="py-6 text-sm text-[var(--text-muted)]">No recent activity yet.</p>
      )}
    </SectionCard>
  );
}

function ReviewIssues({ overview }: { overview: DashboardOverviewResponse }) {
  return (
    <SectionCard>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Needs attention</h2>
        <Link href="/payments" className="text-sm font-semibold text-[var(--accent)] hover:underline">
          Open payments
        </Link>
      </div>
      {overview.reviewIssues.length ? (
        <ul className="divide-y divide-[var(--border-subtle)]">
          {overview.reviewIssues.slice(0, 5).map((issue) => (
            <li className="py-3" key={issue.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)]" href={`/payments/${issue.paymentId}`}>
                    {issue.invoice?.invoiceNumber ?? "Payment review"}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">{issue.summary}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {issue.customer?.name ?? "Unknown customer"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-[var(--danger)] tabular-nums">{formatMoney(issue.amountKobo)}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {RECONCILIATION_STATE_LABELS[issue.state]}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-sm text-[var(--text-muted)]">Nothing needs review. Overdue and pending items will appear here.</p>
      )}
    </SectionCard>
  );
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateInputValue(date);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}
