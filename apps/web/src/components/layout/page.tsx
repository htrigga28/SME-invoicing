import React, { type HTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Body, MetadataLabel, PageTitle, SectionTitle } from "../ui/typography";

export function PageContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mx-auto w-full max-w-[1440px] px-4 py-6 lg:px-6", className)} {...props} />
  );
}

export function PageHeader({
  actions,
  className,
  description,
  eyebrow,
  title
}: {
  actions?: ReactNode;
  className?: string | undefined;
  description?: string | undefined;
  eyebrow?: string | undefined;
  title: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 pb-1 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <MetadataLabel>{eyebrow}</MetadataLabel> : null}
        <PageTitle className={eyebrow ? "mt-2" : undefined}>{title}</PageTitle>
        {description ? <Body className="mt-2 max-w-3xl">{description}</Body> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function PageActions({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)} {...props} />;
}

export function Section({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("space-y-4", className)} {...props} />;
}

export function SectionHeader({
  actions,
  className,
  description,
  title
}: {
  actions?: ReactNode;
  className?: string | undefined;
  description?: string | undefined;
  title: string;
}) {
  return (
    <div
      className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}
    >
      <div>
        <SectionTitle>{title}</SectionTitle>
        {description ? <Body className="mt-1">{description}</Body> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
