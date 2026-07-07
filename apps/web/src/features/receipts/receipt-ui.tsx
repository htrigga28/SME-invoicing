import Link from "next/link";
import React, { type ReactNode } from "react";
import { formatKoboToNaira } from "@sme-invoicing/shared";

import type { ReceiptRefundState } from "./types";

export function PageHeader({
  action,
  description,
  title
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
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
    <button
      className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white"
      onClick={onClick}
      type="button"
    >
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

export function RefundStateBadge({ state }: { state: ReceiptRefundState }) {
  const styles: Record<ReceiptRefundState, string> = {
    none: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    partially_refunded: "bg-amber-50 text-amber-800 ring-amber-200",
    refunded: "bg-violet-50 text-violet-700 ring-violet-200"
  };
  const labels: Record<ReceiptRefundState, string> = {
    none: "No refunds",
    partially_refunded: "Partially refunded",
    refunded: "Refunded"
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ${styles[state]}`}
    >
      {labels[state]}
    </span>
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

  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    !(value instanceof Date)
  ) {
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

export function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 min-w-0 break-words text-sm text-slate-900 [overflow-wrap:anywhere]">
        {value}
      </dd>
    </div>
  );
}
