"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/ui/feedback";
import { Input, Textarea } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader, StatusPanel } from "@/features/invoices/invoice-ui";
import { isApiRequestError } from "@/lib/api";
import { getReminderSettings, putReminderSettings } from "./reminders-api";
import { previewReminder, relativeDayLabel, REMINDER_SAMPLE, validateReminderStep, type ReminderStep } from "./types";

type DraftStep = Omit<ReminderStep, "id"> & { id?: string };
const defaultStep: DraftStep = {
  relativeDays: -3,
  subjectTemplate: "Invoice {{invoiceNumber}} is due soon",
  bodyTemplate: "Hello {{customerName}},\n\nInvoice {{invoiceNumber}} for {{amountDue}} is due on {{dueDate}}.\n\nPay here: {{publicInvoiceUrl}}\n\nThank you,\n{{businessName}}",
  enabled: true
};

export function ReminderSettingsPage() {
  return <AppShell>{({ accessToken, me }) => <SettingsContent accessToken={accessToken} canManage={["owner", "admin"].includes(me.membership.role)} />}</AppShell>;
}

export function SettingsContent({ accessToken, canManage }: { accessToken: string; canManage: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const [steps, setSteps] = useState<DraftStep[]>([]);
  const [suggested, setSuggested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<{ index?: number; step: DraftStep } | null>(null);

  useEffect(() => {
    getReminderSettings(accessToken).then((res) => {
      const data = res as { enabled?: boolean; steps?: DraftStep[]; suggestedSteps?: DraftStep[] };
      const stored = data.steps ?? [];
      setEnabled(data.enabled ?? false);
      setSuggested(stored.length === 0 && canManage);
      setSteps(stored.length ? stored : canManage ? data.suggestedSteps ?? [] : []);
    }).catch((err) => setError(isApiRequestError(err) ? err.message : "Could not load reminder settings."))
      .finally(() => setLoaded(true));
  }, [accessToken, canManage]);

  async function save(nextEnabled: boolean, nextSteps: DraftStep[]) {
    if (!canManage) return;
    if (nextEnabled && nextSteps.length === 0) return setError("Add a reminder before enabling automatic reminders.");
    setSaving(true);
    setError(null);
    try {
      const res = await putReminderSettings(accessToken, { enabled: nextEnabled, steps: nextSteps }) as { enabled?: boolean; steps?: DraftStep[] };
      setEnabled(res.enabled ?? nextEnabled);
      setSteps(res.steps ?? nextSteps);
      setSuggested(false);
    } catch (err) {
      setError(isApiRequestError(err) ? err.message : "Could not save reminder settings.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <LoadingSkeleton />;
  return <div className="space-y-5">
    <PageHeader title="Payment reminders" description="Set when Lumina follows up on unpaid invoices." />
    {error && <StatusPanel tone="error" message={error} />}
    {!canManage && <StatusPanel message="You can view this reminder sequence. An owner or admin can change it." />}
    <SectionCard className="flex flex-wrap items-center justify-between gap-4">
      <div><div className="flex items-center gap-3"><h2 className="font-semibold">Automatic reminders</h2><StatusBadge tone={enabled ? "success" : "neutral"}>{enabled ? "On" : "Off"}</StatusBadge></div>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Eligible customers receive the sequence below. Each message uses the invoice balance at send time.</p></div>
      {canManage && <Button disabled={saving} onClick={() => void save(!enabled, steps)}>{enabled ? "Turn off" : "Turn on"}</Button>}
    </SectionCard>
    <SectionCard className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Reminder sequence</h2><p className="text-sm text-[var(--text-secondary)]">Messages follow the invoice due date.</p></div>
        {canManage && <Button disabled={saving || editing !== null} onClick={() => setEditing({ step: { ...defaultStep } })}>Add reminder</Button>}</div>
      {suggested && <StatusPanel message="Suggested sequence. Review the messages, then turn reminders on to save it." />}
      {steps.length === 0 ? <p className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-subtle)] p-5 text-sm">No reminders are configured.</p> :
        <ol className="space-y-3">{steps.map((step, index) => <li key={step.id ?? `${step.relativeDays}-${index}`} className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold">{relativeDayLabel(step.relativeDays)}</p><p className="mt-1 break-words text-sm">{step.subjectTemplate}</p></div><StatusBadge tone={step.enabled ? "info" : "neutral"}>{step.enabled ? "Active" : "Off"}</StatusBadge></div>
          <p className="mt-3 whitespace-pre-wrap break-words text-xs text-[var(--text-secondary)]">{previewReminder(step.bodyTemplate, REMINDER_SAMPLE).slice(0, 180)}…</p>
          {canManage && <div className="mt-3 flex flex-wrap gap-2"><Button disabled={saving} onClick={() => setEditing({ index, step: { ...step } })}>Edit</Button><Button disabled={saving} onClick={() => void save(enabled, steps.filter((_, i) => i !== index))}>Remove</Button></div>}
        </li>)}</ol>}
    </SectionCard>
    {canManage && editing && <ReminderStepForm key={editing.index ?? "new"} initial={editing.step} isNew={editing.index === undefined} onCancel={() => setEditing(null)} onSave={(draft) => {
      const validation = validateReminderStep(draft);
      if (validation) return setError(validation);
      if (steps.some((step, index) => index !== editing.index && step.relativeDays === draft.relativeDays)) return setError("A reminder already uses this timing.");
      const next = [...steps];
      if (editing.index === undefined) next.push(draft); else next[editing.index] = draft;
      next.sort((a, b) => a.relativeDays - b.relativeDays);
      setEditing(null);
      void save(enabled, next);
    }} />}
  </div>;
}

function ReminderStepForm({ initial, isNew, onSave, onCancel }: { initial: DraftStep; isNew: boolean; onSave: (draft: DraftStep) => void; onCancel: () => void }) {
  const [step, setStep] = useState(initial);
  return <SectionCard className="space-y-4">
    <h2 className="font-semibold">{isNew ? "New reminder" : "Edit reminder"}</h2>
    <div className="grid gap-4 md:grid-cols-2"><label className="space-y-1 text-sm">Timing (days from due date)<Input type="number" min={-30} max={60} value={String(step.relativeDays)} onChange={(e) => setStep({ ...step, relativeDays: Number(e.target.value) })} /></label><label className="space-y-1 text-sm">Subject<Input value={step.subjectTemplate} onChange={(e) => setStep({ ...step, subjectTemplate: e.target.value })} /></label></div>
    <label className="block space-y-1 text-sm">Message<Textarea rows={7} value={step.bodyTemplate} onChange={(e) => setStep({ ...step, bodyTemplate: e.target.value })} /></label>
    <p className="text-xs text-[var(--text-secondary)]">Available variables: {"{{customerName}}, {{invoiceNumber}}, {{amountDue}}, {{dueDate}}, {{businessName}}, {{publicInvoiceUrl}}"}</p>
    <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4"><h3 className="text-sm font-semibold">Preview</h3><p className="mt-2 break-words text-sm font-medium">{previewReminder(step.subjectTemplate, REMINDER_SAMPLE)}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{previewReminder(step.bodyTemplate, REMINDER_SAMPLE)}</p></div>
    <div className="flex flex-wrap gap-2"><Button onClick={() => onSave(step)}>Save reminder</Button><Button onClick={onCancel}>Cancel</Button></div>
  </SectionCard>;
}
