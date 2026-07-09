"use client";

import React from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatKoboToNaira } from "@sme-invoicing/shared";

import type { DashboardOverviewResponse } from "../types";

type CashflowPoint = DashboardOverviewResponse["cashflowTrend"][number];

export function CashflowChart({ data }: { data: CashflowPoint[] }) {
  const tick = { fill: "var(--text-muted)", fontSize: 12 };

  return (
    <ResponsiveContainer height={300} width="100%">
      <LineChart data={data} margin={{ bottom: 8, left: 8, right: 18, top: 12 }}>
        <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
        <XAxis dataKey="period" minTickGap={24} tick={tick} />
        <YAxis tick={tick} tickFormatter={(value) => compactMoney(Number(value))} width={86} />
        <Tooltip
          contentStyle={{
            background: "var(--surface-overlay)",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            color: "var(--text-primary)"
          }}
          formatter={(value) => formatKoboToNaira(Number(value))}
          labelStyle={{ color: "var(--text-secondary)" }}
        />
        <Legend wrapperStyle={{ color: "var(--text-secondary)", fontSize: 12 }} />
        <Line
          dataKey="grossCollectedKobo"
          dot={false}
          name="Gross collections"
          stroke="var(--chart-gross)"
          strokeWidth={2}
          type="monotone"
        />
        <Line
          dataKey="processedRefundsKobo"
          dot={false}
          name="Refunds"
          stroke="var(--chart-refund)"
          strokeWidth={2}
          type="monotone"
        />
        <Line
          dataKey="netCollectedKobo"
          dot={false}
          name="Net collections"
          stroke="var(--chart-net)"
          strokeWidth={2}
          type="monotone"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function compactMoney(kobo: number) {
  const naira = kobo / 100;

  return new Intl.NumberFormat("en-NG", {
    compactDisplay: "short",
    maximumFractionDigits: 1,
    notation: "compact"
  }).format(naira);
}
