"use client";

import React from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  INVOICE_STATUS_LABELS,
  formatKoboToNaira,
  type InvoiceStatus
} from "@sme-invoicing/shared";

import type { DashboardOverviewResponse } from "../types";

type StatusPoint = DashboardOverviewResponse["invoiceStatusBreakdown"][number];

const statusColors: Record<InvoiceStatus, string> = {
  draft: "var(--neutral-state)",
  sent: "var(--neutral-state)",
  viewed: "var(--text-secondary)",
  partially_paid: "var(--warning)",
  paid: "var(--success)",
  overdue: "var(--danger)",
  cancelled: "var(--text-muted)",
  void: "var(--surface-elevated)"
};

export function InvoiceStatusChart({ data }: { data: StatusPoint[] }) {
  const visibleData = data
    .filter((item) => item.count > 0)
    .map((item) => ({
      ...item,
      label: INVOICE_STATUS_LABELS[item.status]
    }));

  if (!visibleData.length) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-[var(--text-muted)]">
        No invoices yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer height={260} width="100%">
      <PieChart>
        <Pie
          cx="50%"
          cy="50%"
          data={visibleData}
          dataKey="count"
          innerRadius={48}
          nameKey="label"
          outerRadius={84}
          paddingAngle={2}
        >
          {visibleData.map((item) => (
            <Cell fill={statusColors[item.status]} key={item.status} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "var(--surface-overlay)",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            color: "var(--text-primary)"
          }}
          formatter={(value, _name, item) => [
            `${value} invoice${Number(value) === 1 ? "" : "s"} · ${formatKoboToNaira(
              Number((item.payload as StatusPoint).balanceKobo)
            )}`,
            "Status"
          ]}
          labelStyle={{ color: "var(--text-secondary)" }}
        />
        <Legend wrapperStyle={{ color: "var(--text-secondary)", fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
