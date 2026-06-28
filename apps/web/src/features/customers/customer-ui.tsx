import Link from "next/link";
import React, { type ReactNode } from "react";

import type { Customer } from "./types";

export function CustomerStatusBadge({ status }: { status: Customer["status"] }) {
  const className =
    status === "active"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : "bg-slate-100 text-slate-600 ring-slate-200";

  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ${className}`}>
      {status === "active" ? "Active" : "Archived"}
    </span>
  );
}

export function PageHeader({
  action,
  description,
  eyebrow,
  title
}: {
  action?: ReactNode;
  description: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-sm font-medium uppercase tracking-wide text-teal-700">{eyebrow}</p>
        ) : null}
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
  }).format(new Date(value));
}
