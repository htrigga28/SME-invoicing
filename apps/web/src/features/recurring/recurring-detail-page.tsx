"use client";

import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, LoadingSkeleton } from "@/components/ui/feedback";
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

function Detail({ accessToken, role, id }: { accessToken: string; role: string; id: string }) {
  const router = useRouter();
  const canManage = ["owner", "admin", "accountant"].includes(role);
  const [data, setData] = useState<{ schedule?: Record<string, unknown>; occurrences?: Record<string, unknown>[] } | null>(null);
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
  const schedule = data.schedule as { name: string; status: string; frequency: string; nextIssueDate: string; amountKobo: number; lastError?: string | null };

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
    <div>
      <PageHeader title={schedule.name} description={`${schedule.frequency} · Next invoice ${formatDate(schedule.nextIssueDate)}`} />
      {schedule.lastError && <StatusPanel tone="warning" message={schedule.lastError} />}
      <p>
        {formatMoney(schedule.amountKobo)} · Status {schedule.status}
      </p>
      {canManage && (
        <div className="flex gap-2">
          {schedule.status === "active" && <Button onClick={() => setConfirm("pause")}>Pause</Button>}
          {schedule.status === "paused" && <Button onClick={() => setConfirm("resume")}>Resume</Button>}
          {["active", "paused"].includes(schedule.status) && <Button onClick={() => setConfirm("cancel")}>End schedule</Button>}
          <Button onClick={() => router.push("/recurring-invoices")}>Back</Button>
        </div>
      )}
      <h2>Generated invoices</h2>
      {(data.occurrences ?? []).length === 0 ? (
        <p>No invoices generated yet.</p>
      ) : (
        <ul>
          {(data.occurrences ?? []).map((o, i) => (
            <li key={i}>
              {String(o.scheduledFor)} — {String(o.status)}
            </li>
          ))}
        </ul>
      )}
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


