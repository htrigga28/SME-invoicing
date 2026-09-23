"use client";

import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  cancelScheduledSend,
  scheduleInvoiceSend,
  setInvoiceReminderPreference
} from "@/features/reminders/reminders-api";
import { isApiRequestError } from "@/lib/api";
import { lagosBusinessDate } from "@/lib/business-date";

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
    invoiceNumber: string;
    customer: { email: string };
    scheduledSendDate?: string | null;
    scheduledSendTo?: string[] | null;
    scheduledSendCc?: string[] | null;
    scheduledSendSubject?: string | null;
    automaticRemindersEnabled?: boolean;
  };
  canManage: boolean;
  onChanged: () => void;
}) {
  const [date, setDate] = useState(invoice.scheduledSendDate ?? "");
  const [to, setTo] = useState((invoice.scheduledSendTo?.length ? invoice.scheduledSendTo : [invoice.customer.email]).join(", "));
  const [cc, setCc] = useState((invoice.scheduledSendCc ?? []).join(", "));
  const [subject, setSubject] = useState(invoice.scheduledSendSubject ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const remindersOn = invoice.automaticRemindersEnabled ?? true;
  const businessDate = lagosBusinessDate();
  const recipientList = (value: string) => value.split(",").map((address) => address.trim()).filter(Boolean);

  async function saveSchedule() {
    if (!date || date < businessDate) return setError("Choose a current or future send date.");
    if (!recipientList(to).length) return setError("Enter at least one recipient.");
    setBusy(true);
    setError(null);
    try {
      await scheduleInvoiceSend(accessToken, invoice.id, { scheduledSendDate: date, to: recipientList(to), cc: recipientList(cc), subject: subject.trim() || null });
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
    <SectionCard className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Invoice automation</h2><StatusBadge tone={invoice.scheduledSendDate || remindersOn ? "info" : "neutral"}>{invoice.scheduledSendDate ? "Scheduled" : invoice.status === "draft" ? "Not scheduled" : remindersOn ? "Reminders on" : "Reminders off"}</StatusBadge></div>
      {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
      {invoice.status === "draft" ? (
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">{invoice.scheduledSendDate ? `Scheduled for ${invoice.scheduledSendDate}.` : "Schedule delivery to issue and email this draft invoice on a chosen business date."}</p>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm">To<Input value={to} readOnly={!canManage} onChange={(e) => setTo(e.target.value)} /></label><label className="space-y-1 text-sm">CC<Input value={cc} readOnly={!canManage} onChange={(e) => setCc(e.target.value)} placeholder="Optional" /></label><label className="space-y-1 text-sm sm:col-span-2">Subject<Input value={subject} readOnly={!canManage} onChange={(e) => setSubject(e.target.value)} placeholder={`Invoice ${invoice.invoiceNumber}`} /></label>{canManage && <label className="space-y-1 text-sm">Send date<Input type="date" min={businessDate} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Schedule send date" /></label>}</div>
          {canManage && <div className="flex flex-wrap gap-2"><Button onClick={saveSchedule} disabled={busy}>{invoice.scheduledSendDate ? "Change schedule" : "Schedule send"}</Button>{invoice.scheduledSendDate && <Button variant="destructive" onClick={cancelSchedule} disabled={busy}>Cancel schedule</Button>}</div>}
          <p className="text-xs text-[var(--text-secondary)]">Lumina runs scheduled sends during the daily automation window in Lagos time (WAT). Exact send time is not guaranteed.</p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">Automatic reminders are {remindersOn ? "on" : "off"} for this invoice.</p>
          {canManage && (
            <Button onClick={() => toggleReminders(!remindersOn)} disabled={busy}>
              Turn {remindersOn ? "off" : "on"}
            </Button>
          )}
        </div>
      )}
    </SectionCard>
  );
}
