import React, { type HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function DisplayMetric({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "font-mono text-4xl font-semibold leading-none text-[var(--text-primary)] tabular-nums md:text-5xl",
        className
      )}
      {...props}
    />
  );
}

export function PageTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn("text-2xl font-semibold text-[var(--text-primary)] md:text-[32px]", className)}
      {...props}
    />
  );
}

export function SectionTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn("text-lg font-semibold text-[var(--text-primary)]", className)} {...props} />
  );
}

export function Body({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm leading-6 text-[var(--text-secondary)]", className)} {...props} />
  );
}

export function MutedText({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm leading-6 text-[var(--text-muted)]", className)} {...props} />;
}

export function MetadataLabel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <span
      className={cn("text-[11px] font-semibold uppercase text-[var(--text-muted)]", className)}
      {...props}
    />
  );
}

export function DataValue({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <span className={cn("font-medium text-[var(--text-primary)]", className)} {...props} />;
}

export function ReferenceText({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <span
      className={cn("font-mono text-sm text-[var(--text-primary)] tabular-nums", className)}
      {...props}
    />
  );
}

export function MoneyText({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <span
      className={cn("font-mono font-semibold text-[var(--text-primary)] tabular-nums", className)}
      {...props}
    />
  );
}
