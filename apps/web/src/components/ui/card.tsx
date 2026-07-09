import React, { type HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)]",
        className
      )}
      {...props}
    />
  );
}

export function SectionCard({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <Card className={cn("p-5", className)} {...props} />;
}

export function DataCard({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <Card className={cn("p-4", className)} {...props} />;
}

export function MetricCard({
  className,
  emphasis = false,
  ...props
}: HTMLAttributes<HTMLElement> & { emphasis?: boolean }) {
  return (
    <Card
      className={cn(
        "p-5",
        emphasis &&
          "border-[color:var(--accent-glow)] bg-[var(--surface-raised)] [box-shadow:inset_0_0_0_1px_var(--accent-glow)]",
        className
      )}
      {...props}
    />
  );
}
