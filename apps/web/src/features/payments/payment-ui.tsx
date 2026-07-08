import Link from "next/link";
import React, { type ReactNode } from "react";
import {
  ATTEMPT_STATE_LABELS,
  PAYMENT_STATUS_LABELS,
  RECONCILIATION_STATE_LABELS,
  formatKoboToNaira,
  type AttemptState,
  type PaymentStatus,
  type ReconciliationState
} from "@sme-invoicing/shared";

import { compactPrimaryActionClassName } from "@/components/ui/styles";

import type { PaymentSettlementAccount } from "./types";

export function AttemptStateBadge({ state }: { state: AttemptState }) {
  const styles: Record<AttemptState, string> = {
    successful: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    active_pending: "bg-blue-50 text-blue-700 ring-blue-200",
    stale_pending: "bg-amber-50 text-amber-800 ring-amber-200",
    failed_attempt: "bg-red-50 text-red-700 ring-red-200",
    abandoned_attempt: "bg-slate-100 text-slate-600 ring-slate-200",
    refunded_attempt: "bg-violet-50 text-violet-700 ring-violet-200",
    superseded: "bg-zinc-100 text-zinc-600 ring-zinc-200",
    review_required: "bg-amber-50 text-amber-800 ring-amber-200",
    unknown: "bg-zinc-100 text-zinc-700 ring-zinc-200"
  };

  return <Badge className={styles[state]}>{ATTEMPT_STATE_LABELS[state]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const styles: Record<PaymentStatus, string> = {
    pending: "bg-amber-50 text-amber-800 ring-amber-200",
    successful: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    failed: "bg-red-50 text-red-700 ring-red-200",
    abandoned: "bg-slate-100 text-slate-600 ring-slate-200",
    refunded: "bg-violet-50 text-violet-700 ring-violet-200"
  };

  return <Badge className={styles[status]}>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}

export function ReconciliationBadge({ state }: { state: ReconciliationState }) {
  const styles: Record<ReconciliationState, string> = {
    matched: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    pending_confirmation: "bg-blue-50 text-blue-700 ring-blue-200",
    stale_pending: "bg-amber-50 text-amber-800 ring-amber-200",
    failed: "bg-red-50 text-red-700 ring-red-200",
    abandoned: "bg-slate-100 text-slate-600 ring-slate-200",
    refunded: "bg-violet-50 text-violet-700 ring-violet-200",
    superseded: "bg-zinc-100 text-zinc-600 ring-zinc-200",
    overpaid: "bg-orange-50 text-orange-800 ring-orange-200",
    resolution_in_progress: "bg-blue-50 text-blue-700 ring-blue-200",
    resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    review_required: "bg-amber-50 text-amber-800 ring-amber-200",
    unknown: "bg-zinc-100 text-zinc-700 ring-zinc-200"
  };

  return <Badge className={styles[state]}>{RECONCILIATION_STATE_LABELS[state]}</Badge>;
}

export function PageHeader({ description, title }: { description: string; title: string }) {
  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-950">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </div>
  );
}

export function StatusPanel({
  action,
  message,
  tone = "info"
}: {
  action?: ReactNode;
  message: string;
  tone?: "error" | "info" | "warning";
}) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-700",
    info: "border-slate-200 bg-white text-slate-600",
    warning: "border-amber-200 bg-amber-50 text-amber-800"
  };

  return (
    <section className={`rounded-lg border p-5 text-sm ${styles[tone]}`}>
      <p>{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </section>
  );
}

export function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button className={compactPrimaryActionClassName} onClick={onClick} type="button">
      Retry
    </button>
  );
}

export function DetailLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Link className="font-medium text-teal-800 hover:text-teal-900" href={href}>
      {children}
    </Link>
  );
}

export function formatDateTime(value: unknown) {
  if (value === null || value === undefined) {
    return "Not recorded";
  }

  if (typeof value === "string" && value.trim() === "") {
    return "Not recorded";
  }

  if (typeof value === "number" && !Number.isFinite(value)) {
    return "Not recorded";
  }

  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

export function formatMoney(kobo: number) {
  return formatKoboToNaira(kobo);
}

export function formatSettlementAccount(account: PaymentSettlementAccount | null) {
  if (!account) {
    return "No matching payout account";
  }

  return `${account.bankName} • ****${account.accountNumberLast4}`;
}

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ${className}`}>
      {children}
    </span>
  );
}
