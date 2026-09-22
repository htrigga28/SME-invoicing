"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableContainer, MobileDataCard, TableHeaderCell } from "@/components/ui/data-table";
import { DataToolbar, StatusTabs } from "@/components/ui/data-toolbar";
import { EmptyState, LoadingSkeleton } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, formatMoney, PageHeader, PrimaryLink } from "@/features/invoices/invoice-ui";
import { listRecurring } from "./recurring-api";
import type { RecurringSchedule } from "./types";

const OPTIONS = [
  { label: "Active", value: "active" },
  { label: "Paused", value: "paused" },
  { label: "Ended", value: "ended" }
];

export function RecurringListPage() {
  return (
    <AppShell>
      {({ accessToken }) => <RecurringListContent accessToken={accessToken} />}
    </AppShell>
  );
}

function RecurringListContent({ accessToken }: { accessToken: string }) {
  const router = useRouter();
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [status, setStatus] = useState("active");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    const query = status === "ended" ? undefined : status;
    listRecurring(accessToken, query)
      .then((res) => {
        if (cancelled) return;
        const rows = (res as { schedules?: RecurringSchedule[] }).schedules ?? [];
        const filtered =
          status === "ended" ? rows.filter((r) => ["completed", "cancelled"].includes(r.status)) : rows;
        setSchedules(filtered);
        setState("ready");
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [accessToken, status]);

  if (state === "loading") return <LoadingSkeleton rows={5} />;
  if (state === "error")
    return (
      <EmptyState
        title="Could not load recurring invoices"
        description="Try again. Schedules generate invoices on their next date."
        action={<Button onClick={() => setStatus("active")}>Retry</Button>}
      />
    );

  return (
    <div>
      <PageHeader
        title="Recurring invoices"
        description="Automated billing schedules. Invoices generate on their next date."
        action={<PrimaryLink href="/recurring-invoices/new">Create recurring invoice</PrimaryLink>}
      />
      <DataToolbar>
        <StatusTabs label="Schedule status" value={status} onChange={setStatus} options={OPTIONS} />
      </DataToolbar>
      {schedules.length === 0 ? (
        <EmptyState
          title={status === "active" ? "No active schedules" : status === "paused" ? "No paused schedules" : "No ended schedules"}
          description="Create a schedule to bill a customer automatically."
          action={<PrimaryLink href="/recurring-invoices/new">Create recurring invoice</PrimaryLink>}
        />
      ) : (
        <DataTableContainer>
          <div className="hidden overflow-x-auto lg:block">
            <DataTable>
              <thead>
                <tr>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Amount</TableHeaderCell>
                  <TableHeaderCell>Repeats</TableHeaderCell>
                  <TableHeaderCell>Next</TableHeaderCell>
                  <TableHeaderCell>Delivery</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s.id} onClick={() => router.push(`/recurring-invoices/${s.id}`)} className="cursor-pointer">
                    <td>{s.name}</td>
                    <td>{formatMoney(s.amountKobo)}</td>
                    <td className="capitalize">{s.frequency}</td>
                    <td>{formatDate(s.nextIssueDate)}</td>
                    <td>{s.autoSend ? "Automatic" : "Draft"}</td>
                    <td>
                      <StatusBadge status={s.status} tone={s.status === "active" ? "success" : s.status === "paused" ? "warning" : "neutral"}>
                        {s.status}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
          <div className="lg:hidden">
            {schedules.map((s) => (
              <MobileDataCard key={s.id} onClick={() => router.push(`/recurring-invoices/${s.id}`)}>
                <p className="font-semibold">
                  {s.name} · {s.status}
                </p>
                <p>
                  {formatMoney(s.amountKobo)} · <span className="capitalize">{s.frequency}</span>
                </p>
                <p>Next invoice {formatDate(s.nextIssueDate)}</p>
                <p>{s.autoSend ? "Automatic delivery" : "Draft delivery"}</p>
              </MobileDataCard>
            ))}
          </div>
        </DataTableContainer>
      )}
      <p className="mt-4 text-sm">
        <Link href="/settings/reminders">Payment reminders</Link> follow up on unpaid invoices automatically.
      </p>
    </div>
  );
}
