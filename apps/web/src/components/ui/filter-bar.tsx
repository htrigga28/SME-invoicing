import React, { type FormHTMLAttributes, type HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function FilterBar({ className, ...props }: FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4",
        className
      )}
      {...props}
    />
  );
}

export function FilterGrid({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid gap-3 lg:items-end", className)} {...props} />;
}

export function FilterActions({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-wrap gap-2 lg:self-end", className)} {...props} />;
}
