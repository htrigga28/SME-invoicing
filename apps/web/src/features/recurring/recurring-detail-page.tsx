"use client";

import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, LoadingSkeleton } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, formatMoney, PageHeader, StatusPanel } from "@/features/invoices/invoice-ui";
import { isApiRequestError } from "@/lib/api";

import { cancelRecurring, getRecurring, pauseRecurring, resumeRecurring } from "./recurring-api";

export function RecurringDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <AppShell>
      {({ accessToken, me }) => <Detail accessToken={accessToken} role={me.membership.role} id={params.id} />}
    </AppShell>
  );
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-[var(--text-secondary)]">{label}</dt><dd className="mt-1 break-words text-sm font-medium capitalize">{value}</dd></div>;
}

function Detail({ accessToken, role, id }: { accessToken: string; role: string; id: string }) {
  const router = useRouter();
  const canManage = ["owner", "admin", "accountant"].includes(role);
  const [data, setData] = useState<{ schedule?: Record<string, unknown>; occurrences?: Record<string, unknown>[]; automation?: Record<string, unknown>[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"pause" | "resume" | "cancel" | null>(null);

  async function load() {
    try {
      const res = await getRecurring(accessToken, id);
      setData(res as typeof data);
    } catch (err) {
      setError(isApiRequestError(err) ? err.message : "Could not load schedule.");
    }
  }

  useEffect(() => { void load();
  }, [accessToken, id]);

  if (error)
    return <EmptyState title="Could not load schedule" description={error} action={<Button onClick={() => router.push("/recurring-invoices")}>Back</Button>} />;
  if (!data?.schedule) return <LoadingSkeleton rows={5} />;
  const schedule = data.schedule as { name: string; status: string; frequency: string; nextIssueDate: string; startDate: string; endDate?: string | null; amountKobo: number; customerId: string; customerName?: string; dueTermsDays: number; autoSend: boolean; toRecipients: string[]; ccRecipients: string[]; emailSubject?: string | null; lastGeneratedAt?: string | null; lastError?: string | null };

  async function act(kind: "pause" | "resume" | "cancel") {
    try {
      if (kind === "pause") await pauseRecurring(accessToken, id);
      if (kind === "resume") await resumeRecurring(accessToken, id);
      if (kind === "cancel") await cancelRecurring(accessToken, id);
      setConfirm(null);
      await load();
    } catch (err) {
      setError(isApiRequestError(err) ? err.message : "Action failed.");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title={schedule.name} description="Recurring invoice schedule" actions={<Link className="text-sm text-[var(--accent)]" href="/recurring-invoices">All schedules</Link>} />
      {schedule.lastError && <StatusPanel tone="warning" message={schedule.lastError} />}
      <SectionCard className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><StatusBadge status={schedule.status} {...(schedule.status === "paused" ? { tone: "warning" as const } : schedule.status === "cancelled" ? { tone: "danger" as const } : {})}>{schedule.status.replaceAll("_", " ")}</StatusBadge><p className="mt-3 text-3xl font-semibold">{formatMoney(schedule.amountKobo)}</p><p className="text-sm text-[var(--text-secondary)]">{schedule.frequency} · {schedule.autoSend ? "Auto-send on" : "Auto-send off"}</p></div>
          {canManage && <div className="flex flex-wrap gap-2">{["active", "paused"].includes(schedule.status) && <Button onClick={() => router.push(`/recurring-invoices/${id}/edit`)}>Edit</Button>}{schedule.status === "active" && <Button variant="secondary" onClick={() => setConfirm("pause")}>Pause</Button>}{schedule.status === "paused" && <Button variant="secondary" onClick={() => setConfirm("resume")}>Resume</Button>}{["active", "paused"].includes(schedule.status) && <Button variant="destructive" onClick={() => setConfirm("cancel")}>End schedule</Button>}</div>}</div>
        <div className="grid gap-3 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-2 lg:grid-cols-4"><DetailField label="Customer" value={schedule.customerName ?? <Link href={`/customers/${schedule.customerId}`} className="text-[var(--accent)]">View customer</Link>} /><DetailField label="Next issue date" value={formatDate(schedule.nextIssueDate)} /><DetailField label="Start date" value={formatDate(schedule.startDate)} /><DetailField label="End date" value={schedule.endDate ? formatDate(schedule.endDate) : "No end date"} /></div>
      </SectionCard>
      <div className="grid gap-4 lg:grid-cols-2"><SectionCard><h2 className="font-semibold">Schedule</h2><dl className="mt-4 grid gap-3 sm:grid-cols-2"><DetailField label="Repeat" value={schedule.frequency} /><DetailField label="Payment terms" value={`${schedule.dueTermsDays} days`} /><DetailField label="To" value={schedule.toRecipients?.join(", ") || "Customer email"} /><DetailField label="CC" value={schedule.ccRecipients?.join(", ") || "None"} /><DetailField label="Subject" value={schedule.emailSubject || "Default invoice subject"} /><DetailField label="Auto-send" value={schedule.autoSend ? "On" : "Off"} /></dl></SectionCard>
        <SectionCard><h2 className="font-semibold">Automation</h2><dl className="mt-4 grid gap-3 sm:grid-cols-2"><DetailField label="Last generated" value={schedule.lastGeneratedAt ? formatDate(schedule.lastGeneratedAt) : "Not run yet"} /><DetailField label="Next run" value={schedule.status === "active" ? formatDate(schedule.nextIssueDate) : "No run scheduled"} /></dl>{(data.automation ?? []).filter((job) => job.lastError).slice(0, 2).map((job, index) => <StatusPanel key={String(job.id ?? index)} tone="warning" message={String(job.lastError)} />)}{schedule.status === "needs_attention" && <StatusPanel tone="warning" message="This schedule needs attention. Review the recent error before resuming." />}</SectionCard></div>
      <SectionCard><h2 className="font-semibold">Generated invoices</h2>{(data.occurrences ?? []).length === 0 ? <p className="mt-3 text-sm text-[var(--text-secondary)]">The first invoice will appear here after the next run.</p> : <ol className="mt-4 divide-y divide-[var(--border-subtle)]">{(data.occurrences ?? []).map((o, index) => {
        const invoice = o.invoice as { id: string; invoiceNumber: string; status: string; issueDate: string; dueDate: string; totalKobo: number; deliveryStatus: string | null } | null | undefined;
        return <li key={String(o.id ?? index)} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{invoice?.invoiceNumber ?? formatDate(String(o.scheduledFor))}</p><p className="text-sm text-[var(--text-secondary)]">Issue date {formatDate(invoice?.issueDate ?? String(o.scheduledFor))}{invoice ? ` · Due ${formatDate(invoice.dueDate)} · ${formatMoney(invoice.totalKobo)}` : ""}</p></div><div className="flex flex-wrap items-center gap-3"><StatusBadge status={invoice?.status ?? String(o.status)}>{invoice?.status ?? String(o.status)}</StatusBadge>{invoice?.deliveryStatus && <span className="text-xs text-[var(--text-secondary)]">Delivery: {invoice.deliveryStatus.replaceAll("_", " ")}</span>}{invoice && <Link className="text-sm font-semibold text-[var(--accent)]" href={`/invoices/${invoice.id}`}>View invoice →</Link>}</div></li>;
      })}</ol>}</SectionCard>
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "cancel" ? "End this schedule?" : confirm === "pause" ? "Pause this schedule?" : "Resume this schedule?"}
        description={
          confirm === "resume"
            ? "Resume advances to the first occurrence on or after today. Missed periods are skipped."
            : confirm === "cancel"
              ? "Ending is terminal. Existing invoices remain."
              : "No new invoices generate while paused."
        }
        confirmLabel={confirm === "cancel" ? "End schedule" : confirm === "pause" ? "Pause" : "Resume"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && act(confirm)}
      />
    </div>
  );
}


