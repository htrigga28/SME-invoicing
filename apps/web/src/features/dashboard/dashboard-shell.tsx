"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ATTEMPT_STATE_LABELS, RECONCILIATION_STATE_LABELS } from "@sme-invoicing/shared";

import { AppShell } from "@/components/layout/app-shell";
import { compactPrimaryActionClassName, secondaryActionClassName } from "@/components/ui/styles";
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
import { InvoiceStatusChart } from "./components/invoice-status-chart";
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
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

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
    ? `${formatDate(overview.period.dateFrom)} - ${formatDate(overview.period.dateTo)}`
    : "Selected period";

  return (
    <section className="space-y-5">
      <PageHeader
        description="Monitor collections, outstanding invoices, and payment activity."
        title="Dashboard"
      />

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-950">Reporting period</p>
            <p className="mt-1 text-sm text-slate-600">
              Period cards use the selected range. Current cards show live operational position.
            </p>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-1">
              {(["7", "30", "90"] as const).map((range) => (
                <button
                  className={rangeButtonClassName(selectedRange === range)}
                  key={range}
                  onClick={() => applyPreset(range)}
                  type="button"
                >
                  Last {range} days
                </button>
              ))}
            </div>
            <form
              className="grid gap-2 sm:grid-cols-[150px_150px_auto]"
              onSubmit={applyCustomRange}
            >
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  From
                </span>
                <input
                  className="mt-1 min-h-9 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-700"
                  onChange={(event) => setCustomFrom(event.target.value)}
                  type="date"
                  value={customFrom}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  To
                </span>
                <input
                  className="mt-1 min-h-9 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-700"
                  onChange={(event) => setCustomTo(event.target.value)}
                  type="date"
                  value={customTo}
                />
              </label>
              <button className={`${secondaryActionClassName} min-h-9 self-end`} type="submit">
                Apply
              </button>
            </form>
          </div>
        </div>
      </section>

      {error ? <StatusPanel message={error} tone="error" /> : null}
      {state === "loading" ? <StatusPanel message="Loading dashboard..." /> : null}

      {state === "error" ? (
        <StatusPanel
          action={
            <button
              className={compactPrimaryActionClassName}
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
          <PaymentSetupPanel overview={overview} role={role} />

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              emphasis
              label="Selected period"
              title="Net collected"
              value={formatMoney(overview.financialActivity.netCollectedKobo)}
            />
            <MetricCard
              label="Current"
              title="Outstanding"
              value={formatMoney(overview.currentPosition.outstandingKobo)}
              detail={`${overview.currentPosition.outstandingInvoiceCount} invoice${
                overview.currentPosition.outstandingInvoiceCount === 1 ? "" : "s"
              }`}
            />
            <MetricCard
              label="Current"
              title="Overdue"
              value={formatMoney(overview.currentPosition.overdueKobo)}
              tone={overview.currentPosition.overdueInvoiceCount > 0 ? "warning" : "neutral"}
              detail={`${overview.currentPosition.overdueInvoiceCount} invoice${
                overview.currentPosition.overdueInvoiceCount === 1 ? "" : "s"
              }`}
            />
            <MetricCard
              label="Current"
              title="Review required"
              value={overview.currentPosition.unresolvedReviewCount.toLocaleString("en-NG")}
              tone={overview.currentPosition.unresolvedReviewCount > 0 ? "danger" : "neutral"}
              detail={`${overview.currentPosition.activePendingPaymentCount} active pending`}
            />
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label={periodLabel}
              title="Gross collected"
              value={formatMoney(overview.financialActivity.grossCollectedKobo)}
            />
            <MetricCard
              label={periodLabel}
              title="Refunds"
              value={formatMoney(overview.financialActivity.processedRefundsKobo)}
            />
            <MetricCard
              label={periodLabel}
              title="Successful payments"
              value={overview.financialActivity.successfulPaymentCount.toLocaleString("en-NG")}
            />
            <MetricCard
              label={periodLabel}
              title="Receipts issued"
              value={overview.financialActivity.receiptsIssuedCount.toLocaleString("en-NG")}
            />
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <SectionHeading
              detail={`${overview.period.granularity} buckets · ${overview.period.timezone}`}
              title="Cashflow trend"
            />
            <CashflowChart data={overview.cashflowTrend} />
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <ChartPanel title="Invoice status distribution">
              <InvoiceStatusChart data={overview.invoiceStatusBreakdown} />
            </ChartPanel>
            <ChartPanel title="Outstanding aging">
              <OutstandingAgingChart aging={overview.outstandingAging} />
            </ChartPanel>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <RecentInvoices overview={overview} />
            <RecentPayments overview={overview} />
            <RecentReceipts overview={overview} />
            <ReviewIssues overview={overview} />
          </section>
        </>
      ) : null}
    </section>
  );
}

function PaymentSetupPanel({
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
      <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <p className="font-semibold">Online payments active</p>
        <p className="mt-1">
          {setup.bankName} payout account ending {setup.accountNumberLast4}.
        </p>
      </section>
    );
  }

  if (setup.status === "verification_delayed") {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Payment Setup verification delayed</p>
        <p className="mt-1">
          Online payments are not active yet. Customers can view invoices while setup is pending.
        </p>
      </section>
    );
  }

  const isDisabled = setup.status === "disabled";
  const actionLabel = isDisabled ? "Reactivate payment setup" : "Set up online payments";

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
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
          <Link className={compactPrimaryActionClassName} href="/settings/payment-setup">
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function MetricCard({
  detail,
  emphasis = false,
  label,
  title,
  tone = "neutral",
  value
}: {
  detail?: string;
  emphasis?: boolean;
  label: string;
  title: string;
  tone?: "danger" | "neutral" | "warning";
  value: string;
}) {
  const toneClassName = {
    danger: "text-red-700",
    neutral: "text-slate-950",
    warning: "text-amber-700"
  }[tone];

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <h2 className="mt-2 text-sm font-medium text-slate-600">{title}</h2>
      <p className={`mt-2 font-semibold ${toneClassName} ${emphasis ? "text-3xl" : "text-2xl"}`}>
        {value}
      </p>
      {detail ? <p className="mt-2 text-sm text-slate-500">{detail}</p> : null}
    </article>
  );
}

function ChartPanel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <SectionHeading title={title} />
      {children}
    </section>
  );
}

function SectionHeading({ detail, title }: { detail?: string; title: string }) {
  return (
    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      {detail ? (
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{detail}</p>
      ) : null}
    </div>
  );
}

function RecentInvoices({ overview }: { overview: DashboardOverviewResponse }) {
  return (
    <DataPanel emptyMessage="No recent invoices." title="Recent invoices">
      {overview.recentInvoices.map((invoice) => (
        <li className="flex items-center justify-between gap-3 py-3" key={invoice.id}>
          <div className="min-w-0">
            <Link className="font-medium text-slate-950" href={`/invoices/${invoice.id}`}>
              {invoice.invoiceNumber}
            </Link>
            <p className="truncate text-sm text-slate-600">{invoice.customer.name}</p>
            <p className="text-xs text-slate-500">Due {formatDate(invoice.dueDate)}</p>
          </div>
          <div className="shrink-0 text-right">
            <InvoiceStatusBadge status={invoice.status} />
            <p className="mt-2 text-sm font-medium text-slate-700">
              {formatMoney(invoice.balanceDueKobo)}
            </p>
          </div>
        </li>
      ))}
    </DataPanel>
  );
}

function RecentPayments({ overview }: { overview: DashboardOverviewResponse }) {
  return (
    <DataPanel emptyMessage="No recent payment activity." title="Recent payments">
      {overview.recentPayments.map((payment) => (
        <li className="flex items-center justify-between gap-3 py-3" key={payment.id}>
          <div className="min-w-0">
            <Link className="truncate font-medium text-slate-950" href={`/payments/${payment.id}`}>
              {payment.providerReference}
            </Link>
            <p className="truncate text-sm text-slate-600">
              {payment.customer?.name ?? "Unknown customer"} ·{" "}
              {payment.invoice?.invoiceNumber ?? "No invoice"}
            </p>
            <p className="text-xs text-slate-500">
              {formatDateTime(payment.paidAt ?? payment.createdAt)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold text-slate-950">
              {formatMoney(payment.amountKobo)}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {ATTEMPT_STATE_LABELS[payment.state]}
            </p>
          </div>
        </li>
      ))}
    </DataPanel>
  );
}

function RecentReceipts({ overview }: { overview: DashboardOverviewResponse }) {
  return (
    <DataPanel emptyMessage="No receipts issued yet." title="Recent receipts">
      {overview.recentReceipts.map((receipt) => (
        <li className="flex items-center justify-between gap-3 py-3" key={receipt.id}>
          <div className="min-w-0">
            <Link className="font-medium text-slate-950" href={`/receipts/${receipt.id}`}>
              {receipt.receiptNumber}
            </Link>
            <p className="truncate text-sm text-slate-600">
              {receipt.customer.name} · {receipt.invoice.invoiceNumber}
            </p>
            <p className="text-xs text-slate-500">{formatDateTime(receipt.issuedAt)}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold text-slate-950">
              {formatMoney(receipt.amountKobo)}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {receipt.refundSummary.refundState.replaceAll("_", " ")}
            </p>
          </div>
        </li>
      ))}
    </DataPanel>
  );
}

function ReviewIssues({ overview }: { overview: DashboardOverviewResponse }) {
  return (
    <DataPanel emptyMessage="No unresolved review items." title="Current review issues">
      {overview.reviewIssues.map((issue) => (
        <li className="py-3" key={issue.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link className="font-medium text-slate-950" href={`/payments/${issue.paymentId}`}>
                {issue.invoice?.invoiceNumber ?? "Payment review"}
              </Link>
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">{issue.summary}</p>
              <p className="mt-1 text-xs text-slate-500">
                {issue.customer?.name ?? "Unknown customer"}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold text-red-700">{formatMoney(issue.amountKobo)}</p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                {RECONCILIATION_STATE_LABELS[issue.state]}
              </p>
            </div>
          </div>
        </li>
      ))}
    </DataPanel>
  );
}

function DataPanel({
  children,
  emptyMessage,
  title
}: {
  children: ReactNode[];
  emptyMessage: string;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <SectionHeading title={title} />
      {children.length ? (
        <ul className="divide-y divide-slate-100">{children}</ul>
      ) : (
        <p className="py-6 text-sm text-slate-500">{emptyMessage}</p>
      )}
    </section>
  );
}

function rangeButtonClassName(active: boolean) {
  return `min-h-8 rounded px-3 text-sm font-semibold transition-colors ${
    active ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-950"
  }`;
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
