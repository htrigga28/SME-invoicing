import React, { type HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type StatusTone = "success" | "warning" | "danger" | "neutral";

const toneClassNames: Record<StatusTone, string> = {
  success: "bg-[var(--success-muted)] text-[var(--success)] ring-[var(--success-border)]",
  warning: "bg-[var(--warning-muted)] text-[var(--warning)] ring-[var(--warning-border)]",
  danger: "bg-[var(--danger-muted)] text-[var(--danger)] ring-[var(--danger-border)]",
  neutral:
    "bg-[var(--neutral-state-muted)] text-[var(--neutral-state)] ring-[var(--border-default)]"
};

const successStatuses = new Set([
  "paid",
  "successful",
  "active",
  "processed",
  "matched",
  "resolved"
]);
const warningStatuses = new Set([
  "pending",
  "active_pending",
  "awaiting_confirmation",
  "pending_confirmation",
  "stale_pending",
  "partially_paid",
  "verification_delayed",
  "refund_processing",
  "review_required",
  "resolution_in_progress",
  "partially_refunded"
]);
const dangerStatuses = new Set(["overdue", "failed", "failed_attempt", "overpayment", "overpaid"]);

export function getStatusTone(status: string): StatusTone {
  if (successStatuses.has(status)) {
    return "success";
  }

  if (warningStatuses.has(status)) {
    return "warning";
  }

  if (dangerStatuses.has(status)) {
    return "danger";
  }

  return "neutral";
}

export function statusBadgeClassName({
  className,
  tone
}: {
  className?: string | undefined;
  tone: StatusTone;
}) {
  return cn(
    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-none ring-1",
    toneClassNames[tone],
    className
  );
}

export function StatusBadge({
  children,
  className,
  status,
  tone,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  status?: string;
  tone?: StatusTone;
}) {
  const resolvedTone = tone ?? getStatusTone(status ?? "neutral");

  return (
    <span className={statusBadgeClassName({ className, tone: resolvedTone })} {...props}>
      {children}
    </span>
  );
}
