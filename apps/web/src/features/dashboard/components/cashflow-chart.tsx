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
  return (
    <ResponsiveContainer height={300} width="100%">
      <LineChart data={data} margin={{ bottom: 8, left: 8, right: 18, top: 12 }}>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
        <XAxis dataKey="period" minTickGap={24} tick={{ fill: "#64748b", fontSize: 12 }} />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 12 }}
          tickFormatter={(value) => compactMoney(Number(value))}
          width={86}
        />
        <Tooltip formatter={(value) => formatKoboToNaira(Number(value))} />
        <Legend />
        <Line
          dataKey="grossCollectedKobo"
          dot={false}
          name="Gross collections"
          stroke="#0f766e"
          strokeWidth={2}
          type="monotone"
        />
        <Line
          dataKey="processedRefundsKobo"
          dot={false}
          name="Refunds"
          stroke="#be123c"
          strokeWidth={2}
          type="monotone"
        />
        <Line
          dataKey="netCollectedKobo"
          dot={false}
          name="Net collections"
          stroke="#2563eb"
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
