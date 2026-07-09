import React, { type ReactNode } from "react";
import {
  INVOICE_STATUS_LABELS,
  formatKoboToNaira,
  type InvoiceStatus
} from "@sme-invoicing/shared";

import { PageHeader as SharedPageHeader } from "@/components/layout/page";
import { LinkButton } from "@/components/ui/button";
import { Alert, type AlertTone } from "@/components/ui/feedback";
import { StatusBadge, getStatusTone } from "@/components/ui/status-badge";

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <StatusBadge status={status} tone={getStatusTone(status)}>
      {INVOICE_STATUS_LABELS[status]}
    </StatusBadge>
  );
}

export function PageHeader({
  action,
  description,
  title
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return <SharedPageHeader actions={action} description={description} title={title} />;
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
  const date = value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00.000Z`);

  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

export function formatMoney(kobo: number) {
  return formatKoboToNaira(kobo);
}
