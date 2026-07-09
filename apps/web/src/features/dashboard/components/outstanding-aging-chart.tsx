"use client";

import React from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatKoboToNaira } from "@sme-invoicing/shared";

import type { DashboardOverviewResponse } from "../types";

type Aging = DashboardOverviewResponse["outstandingAging"];

export function OutstandingAgingChart({ aging }: { aging: Aging }) {
  const tick = { fill: "var(--text-muted)", fontSize: 12 };
  const data = [
    { label: "Not due", amountKobo: aging.notDueKobo },
    { label: "1-7 days", amountKobo: aging.overdue1To7DaysKobo },
    { label: "8-30 days", amountKobo: aging.overdue8To30DaysKobo },
    { label: "31+ days", amountKobo: aging.overdue31PlusDaysKobo }
  ];

  return (
    <ResponsiveContainer height={260} width="100%">
      <BarChart data={data} margin={{ bottom: 8, left: 8, right: 18, top: 12 }}>
        <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={tick} />
        <YAxis tick={tick} tickFormatter={(value) => compactMoney(Number(value))} width={82} />
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
        <Bar
          dataKey="amountKobo"
          fill="var(--chart-gross)"
          name="Outstanding balance"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
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
