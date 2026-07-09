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

import { PageHeader as SharedPageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Alert, type AlertTone } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";

import type { PaymentSettlementAccount } from "./types";

export function AttemptStateBadge({ state }: { state: AttemptState }) {
  return <Badge status={state}>{ATTEMPT_STATE_LABELS[state]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge status={status}>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}

export function ReconciliationBadge({ state }: { state: ReconciliationState }) {
  return <Badge status={state}>{RECONCILIATION_STATE_LABELS[state]}</Badge>;
}

export function PageHeader({ description, title }: { description: string; title: string }) {
  return <SharedPageHeader description={description} title={title} />;
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

function Badge({ children, status }: { children: ReactNode; status: string }) {
  return <StatusBadge status={status}>{children}</StatusBadge>;
}
