import React, { type HTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Button } from "./button";

export function DataTableContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)]",
        className
      )}
      {...props}
    />
  );
}

export function DataTableToolbar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-[var(--border-subtle)] p-4 lg:flex-row lg:items-end lg:justify-between",
        className
      )}
      {...props}
    />
  );
}

export function DataTable({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full text-left text-sm", className)} {...props} />;
}

export function TableHeaderCell({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "sticky top-0 bg-[var(--surface-raised)] px-4 py-3 text-[11px] font-semibold uppercase text-[var(--text-muted)]",
        className
      )}
      {...props}
    />
  );
}

export function MobileDataCard({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <article
      className={cn(
        "space-y-3 border-b border-[var(--border-subtle)] p-4 last:border-b-0",
        className
      )}
      {...props}
    />
  );
}

export function Pagination({
  canGoNext,
  canGoPrevious,
  label,
  onNext,
  onPrevious
}: {
  canGoNext: boolean;
  canGoPrevious: boolean;
  label: ReactNode;
  onNext: () => void;
  onPrevious: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-[var(--border-subtle)] px-4 py-3 text-sm text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
      <div>{label}</div>
      <div className="flex gap-2">
        <Button
          disabled={!canGoPrevious}
          onClick={onPrevious}
          size="sm"
          type="button"
          variant="outline"
        >
          Previous
        </Button>
        <Button disabled={!canGoNext} onClick={onNext} size="sm" type="button" variant="outline">
          Next
        </Button>
      </div>
    </div>
  );
}
