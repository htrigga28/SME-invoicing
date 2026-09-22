"use client";

import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import {
  cancelScheduledSend,
  scheduleInvoiceSend,
  setInvoiceReminderPreference
} from "@/features/reminders/reminders-api";
import { isApiRequestError } from "@/lib/api";

export function InvoiceAutomationPanel({
  accessToken,
  invoice,
  canManage,
  onChanged
}: {
  accessToken: string;
  invoice: {
    id: string;
    status: string;
    scheduledSendDate?: string | null;
    automaticRemindersEnabled?: boolean;
  };
  canManage: boolean;
  onChanged: () => void;
}) {
  const [date, setDate] = useState(invoice.scheduledSendDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const remindersOn = invoice.automaticRemindersEnabled ?? true;

  async function saveSchedule() {
    if (!date) return setError("Choose a send date.");
    setBusy(true);
    setError(null);
    try {
      await scheduleInvoiceSend(accessToken, invoice.id, { scheduledSendDate: date });
      onChanged();
    } catch (err) {
      setError(isApiRequestError(err) ? err.message : "Could not schedule send.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelSchedule() {
    setBusy(true);
    setError(null);
    try {
      await cancelScheduledSend(accessToken, invoice.id);
      setDate("");
      onChanged();
    } catch (err) {
      setError(isApiRequestError(err) ? err.message : "Could not cancel schedule.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleReminders(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      await setInvoiceReminderPreference(accessToken, invoice.id, next);
      onChanged();
    } catch (err) {
      setError(isApiRequestError(err) ? err.message : "Could not update reminders.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded border p-4">
      <h2>Automation</h2>
      {error && <p role="alert">{error}</p>}
      {invoice.status === "draft" ? (
        invoice.scheduledSendDate ? (
          <div>
            <p>
              Scheduled to send {invoice.scheduledSendDate}
            </p>
            {canManage && (
              <div className="flex gap-2">
                <Input type="date" value={date || invoice.scheduledSendDate} onChange={(e) => setDate(e.target.value)} />
                <Button onClick={saveSchedule} disabled={busy}>
                  Change
                </Button>
                <Button onClick={cancelSchedule} disabled={busy}>
                  Cancel schedule
                </Button>
              </div>
            )}
          </div>
        ) : (
          canManage && (
            <div className="flex gap-2">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Schedule send date" />
              <Button onClick={saveSchedule} disabled={busy}>
                Schedule send
              </Button>
            </div>
          )
        )
      ) : (
        <div>
          <p>
            Automatic reminders {remindersOn ? "On" : "Off for this invoice"}
          </p>
          {canManage && (
            <Button onClick={() => toggleReminders(!remindersOn)} disabled={busy}>
              Turn {remindersOn ? "off" : "on"}
            </Button>
          )}
        </div>
      )}
      <p className="text-sm text-muted">Sends run once daily. No exact clock time is promised.</p>
    </section>
  );
}
