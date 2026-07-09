import React, { type ReactNode } from "react";

import { PageHeader as SharedPageHeader } from "@/components/layout/page";
import { LinkButton } from "@/components/ui/button";
import { Alert, type AlertTone } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";

import type { Customer } from "./types";

export function CustomerStatusBadge({ status }: { status: Customer["status"] }) {
  return (
    <StatusBadge status={status} tone={status === "active" ? "success" : "neutral"}>
      {status === "active" ? "Active" : "Archived"}
    </StatusBadge>
  );
}

export function PageHeader({
  action,
  description,
  eyebrow,
  title
}: {
  action?: ReactNode;
  description: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <SharedPageHeader actions={action} description={description} eyebrow={eyebrow} title={title} />
  );
}

export function PrimaryLink({ children, href }: { children: ReactNode; href: string }) {
  return <LinkButton href={href}>{children}</LinkButton>;
}

export function StatusPanel({
  action,
  message,
  tone = "info"
}: {
  action?: ReactNode;
  message: string;
  tone?: "error" | "info" | "success" | "warning";
}) {
  return (
    <Alert action={action} tone={tone as AlertTone}>
      <p>{message}</p>
    </Alert>
  );
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}
