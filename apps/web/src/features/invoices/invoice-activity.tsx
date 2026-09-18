import React from "react";

import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";

import type { DeliveryState, InvoiceActivityItem } from "./types";

const DELIVERY_LABELS: Record<DeliveryState, string> = {
  not_emailed: "Not emailed",
  sending: "Sending",
  accepted: "Accepted",
  delivered: "Delivered",
  delayed: "Delayed",
  failed: "Failed"
};

const DELIVERY_TONES: Record<DeliveryState, StatusTone> = {
  not_emailed: "neutral",
  sending: "info",
  accepted: "info",
  delivered: "success",
  delayed: "warning",
  failed: "danger"
};

export function DeliveryBadge({ state }: { state: DeliveryState }) {
  return <StatusBadge tone={DELIVERY_TONES[state]}>{DELIVERY_LABELS[state]}</StatusBadge>;
}

function formatActivityDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function InvoiceActivityTimeline({ activity }: { activity: InvoiceActivityItem[] }) {
  if (activity.length === 0) {
    return (
      <p className="mt-3 text-sm text-[var(--text-secondary)]">
        No activity recorded for this invoice yet.
      </p>
    );
  }

  return (
    <ol className="mt-3 space-y-3">
      {activity.map((item) => (
        <li
          className="border-l-2 border-[var(--border-default)] pl-3"
          key={item.id}
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-[var(--text-primary)]">{item.title}</p>
            {item.tone && item.tone !== "neutral" ? (
              <span
                aria-hidden="true"
                className={`inline-block h-2 w-2 rounded-full ${
                  item.tone === "success"
                    ? "bg-[var(--success)]"
                    : item.tone === "warning"
                      ? "bg-[var(--warning)]"
                      : item.tone === "danger"
                        ? "bg-[var(--danger)]"
                        : "bg-[var(--info)]"
                }`}
              />
            ) : null}
          </div>
          {item.detail ? (
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{item.detail}</p>
          ) : null}
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {formatActivityDate(item.occurredAt)}
            {item.actor?.name ? ` · ${item.actor.name}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}
