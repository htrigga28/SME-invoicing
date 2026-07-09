import Link from "next/link";
import React, { type ReactNode } from "react";
import { formatKoboToNaira } from "@sme-invoicing/shared";

import { PageHeader as SharedPageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Alert, type AlertTone } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";

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
  return <SharedPageHeader actions={action} description={description} title={title} />;
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
  return (
    <Alert action={action} tone={tone as AlertTone}>
      <p>{message}</p>
    </Alert>
  );
}

export function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <Button onClick={onClick} size="sm" type="button">
      Retry
    </Button>
  );
}

export function DetailLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Link className="font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]" href={href}>
      {children}
    </Link>
  );
}

export function RefundStateBadge({ state }: { state: ReceiptRefundState }) {
  const labels: Record<ReceiptRefundState, string> = {
    none: "No refunds",
    partially_refunded: "Partially refunded",
    refunded: "Refunded"
  };

  return <StatusBadge status={state}>{labels[state]}</StatusBadge>;
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

export function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-1 min-w-0 break-words text-sm text-[var(--text-primary)] [overflow-wrap:anywhere]">
        {value}
      </dd>
    </div>
  );
}
