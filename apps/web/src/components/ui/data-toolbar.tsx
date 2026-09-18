import React, { type HTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export function DataToolbar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3 lg:flex-row lg:items-center",
        className
      )}
      {...props}
    />
  );
}

export function DataToolbarSearch({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-w-0 flex-1", className)} {...props} />;
}

export function DataToolbarFilters({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)} {...props} />;
}

export function DataToolbarActions({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex shrink-0 flex-wrap items-center gap-2 lg:ml-auto", className)} {...props} />
  );
}

export function StatusTabs<T extends string>({
  options,
  value,
  onChange,
  label
}: {
  options: Array<{ label: string; value: T; count?: number }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div aria-label={label} className="flex flex-wrap gap-1" role="tablist">
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(opt.value)}
            type="button"
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
              selected
                ? "border-[var(--accent-border-strong)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "border-[var(--border-default)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            )}
          >
            {opt.label}
            {typeof opt.count === "number" ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  selected ? "bg-white/20" : "bg-[var(--surface-raised)] text-[var(--text-muted)]"
                )}
              >
                {opt.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
  label
}: {
  tabs: Array<{ label: string; value: string }>;
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div aria-label={label} className="flex gap-1 border-b border-[var(--border-subtle)]" role="tablist">
      {tabs.map((t) => {
        const selected = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(t.value)}
            type="button"
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition duration-150",
              selected
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function PageTabsWrapper({ children }: { children: ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}
