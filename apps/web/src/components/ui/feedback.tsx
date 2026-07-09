import React, { type HTMLAttributes, type ReactNode } from "react";
import { AlertCircle, Inbox, Loader2 } from "lucide-react";

import { cn } from "@/lib/cn";

import { Button } from "./button";

export type AlertTone = "info" | "success" | "warning" | "error";

const alertToneClassNames: Record<AlertTone, string> = {
  info: "border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)]",
  success: "border-[var(--success-border)] bg-[var(--success-muted)] text-[var(--success)]",
  warning: "border-[var(--warning-border)] bg-[var(--warning-muted)] text-[var(--warning)]",
  error: "border-[var(--danger-border)] bg-[var(--danger-muted)] text-[var(--danger)]"
};

export function Alert({
  action,
  children,
  className,
  tone = "info",
  title,
  ...props
}: HTMLAttributes<HTMLElement> & {
  action?: ReactNode;
  tone?: AlertTone;
  title?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-card)] border p-5 text-sm",
        alertToneClassNames[tone],
        className
      )}
      {...props}
    >
      {title ? <h2 className="font-semibold text-[var(--text-primary)]">{title}</h2> : null}
      <div className={cn("leading-6", title && "mt-1")}>{children}</div>
      {action ? <div className="mt-3">{action}</div> : null}
    </section>
  );
}

export function EmptyState({
  action,
  className,
  description,
  filtered = false,
  title
}: {
  action?: ReactNode;
  className?: string;
  description: string;
  filtered?: boolean;
  title: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 text-center",
        className
      )}
      data-filtered-empty={filtered ? "" : undefined}
    >
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-muted)]">
        <Inbox aria-hidden="true" className="h-5 w-5" />
      </div>
      <h2 className="mt-3 text-base font-semibold text-[var(--text-primary)]">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[var(--text-muted)]">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}

export function ErrorState({
  className,
  message,
  onRetry,
  title = "Something went wrong"
}: {
  className?: string;
  message: string;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--danger-border)] bg-[var(--danger-muted)] p-6 text-sm text-[var(--danger)]",
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h2 className="font-semibold text-[var(--text-primary)]">{title}</h2>
            <p className="mt-1 leading-6">{message}</p>
          </div>
        </div>
        {onRetry ? (
          <Button onClick={onRetry} size="sm" type="button" variant="outline">
            Retry
          </Button>
        ) : null}
      </div>
    </section>
  );
}

export function LoadingSkeleton({ className, rows = 3 }: { className?: string; rows?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5",
        className
      )}
      role="status"
    >
      <div className="mb-4 flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        Loading
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <div
            className="h-4 rounded bg-[linear-gradient(90deg,var(--surface-raised),var(--surface-elevated),var(--surface-raised))]"
            key={index}
          />
        ))}
      </div>
    </div>
  );
}
