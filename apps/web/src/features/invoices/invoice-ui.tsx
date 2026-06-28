import Link from "next/link";
import React, { type ReactNode } from "react";
import {
  INVOICE_STATUS_LABELS,
  formatKoboToNaira,
  type InvoiceStatus
} from "@sme-invoicing/shared";

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const styles: Record<InvoiceStatus, string> = {
    draft: "bg-slate-100 text-slate-700 ring-slate-200",
    sent: "bg-blue-50 text-blue-700 ring-blue-200",
    viewed: "bg-cyan-50 text-cyan-700 ring-cyan-200",
    partially_paid: "bg-amber-50 text-amber-800 ring-amber-200",
    paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    overdue: "bg-red-50 text-red-700 ring-red-200",
    cancelled: "bg-slate-100 text-slate-500 ring-slate-200",
    void: "bg-zinc-100 text-zinc-700 ring-zinc-200"
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ${styles[status]}`}
    >
      {INVOICE_STATUS_LABELS[status]}
    </span>
  );
}

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

export function PrimaryLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Link className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white" href={href}>
      {children}
    </Link>
  );
}

export function StatusPanel({
  action,
  message,
  tone = "info"
}: {
  action?: ReactNode;
  message: string;
  tone?: "error" | "info" | "success" | "warning";
}) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-700",
    info: "border-slate-200 bg-white text-slate-600",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800"
  };

  return (
    <section className={`rounded-lg border p-5 text-sm ${styles[tone]}`}>
      <p>{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </section>
  );
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function formatMoney(kobo: number) {
  return formatKoboToNaira(kobo);
}
