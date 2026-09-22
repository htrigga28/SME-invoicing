"use client";

import React, { useEffect, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingSkeleton } from "@/components/ui/feedback";
import { Input, Textarea } from "@/components/ui/form";
import { PageHeader, StatusPanel } from "@/features/invoices/invoice-ui";
import { isApiRequestError } from "@/lib/api";

import { getReminderSettings, putReminderSettings } from "./reminders-api";
import { previewReminder, relativeDayLabel, REMINDER_SAMPLE, validateReminderStep, type ReminderStep } from "./types";

export function ReminderSettingsPage() {
  return (
    <AppShell>
      {({ accessToken }) => <SettingsContent accessToken={accessToken} />}
    </AppShell>
  );
}

function SettingsContent({ accessToken }: { accessToken: string }) {
  const [enabled, setEnabled] = useState(false);
  const [steps, setSteps] = useState<ReminderStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<Partial<ReminderStep> & { index?: number }>({});

  useEffect(() => {
    getReminderSettings(accessToken)
      .then((res) => {
        const data = res as { enabled?: boolean; steps?: ReminderStep[] };
        setEnabled(data.enabled ?? false);
        setSteps(data.steps ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [accessToken]);

  async function save(nextEnabled: boolean, nextSteps: ReminderStep[]) {
    setSaving(true);
    setError(null);
    try {
      const res = (await putReminderSettings(accessToken, { enabled: nextEnabled, steps: nextSteps })) as {
        enabled?: boolean;
        steps?: ReminderStep[];
      };
      setEnabled(res.enabled ?? nextEnabled);
      setSteps(res.steps ?? nextSteps);
    } catch (err) {
      setError(isApiRequestError(err) ? err.message : "Could not save reminder settings.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <LoadingSkeleton />;

  return (
    <div>
      <PageHeader
        title="Payment reminders"
        description="Automatically follow up on unpaid invoices. Reminders are off until you enable them."
      />
      {error && <StatusPanel tone="error" message={error} />}
      <label><input type="checkbox" checked={enabled} disabled={saving} onChange={(e) => save(e.target.checked, steps)} />
        Enable automatic reminders
      </label>
      <p>When enabled, customers receive the sequence below for unpaid invoices. Amounts use the current balance at send time.</p>
      <h2>Reminder sequence</h2>
      {steps.length === 0 && <EmptyState title="No reminder steps yet" description="Add before-due and overdue steps. Enabling starts the sequence for unpaid invoices." />}
      <ul>
        {steps.map((step, index) => (
          <li key={step.id}>
            <strong>{relativeDayLabel(step.relativeDays)}</strong>
            <p>Subject: {step.subjectTemplate}</p>
            <Button
              onClick={() => {
                const next = steps.filter((_, i) => i !== index);
                save(enabled, next);
              }}
            >
              Remove
            </Button>
            <Button onClick={() => setEditing({ ...step, index })}>Edit</Button>
          </li>
        ))}
      </ul>
      <ReminderStepForm
        initial={editing}
        onCancel={() => setEditing({})}
        onSave={(draft) => {
          const err = validateReminderStep(draft as { relativeDays: number; subjectTemplate: string; bodyTemplate: string });
          if (err) return setError(err);
          const next = [...steps];
          if (draft.index !== undefined) {
            const { index: _dropIndex, id: _dropId, ...clean } = draft as Partial<ReminderStep> & { index?: number; id?: string }; next[draft.index] = { ...(next[draft.index] as ReminderStep), ...clean } as ReminderStep;
          } else {
            const { index: _i, id: _id, ...rest } = draft as Partial<ReminderStep> & { index?: number; id?: string }; next.push({ id: `new-${Date.now()}`, enabled: true, ...rest } as ReminderStep);
          }
          setEditing({});
          save(enabled, next);
        }}
      />
    </div>
  );
}

function ReminderStepForm({
  initial,
  onSave,
  onCancel
}: {
  initial: Partial<ReminderStep> & { index?: number };
  onSave: (draft: Partial<ReminderStep> & { index?: number }) => void;
  onCancel: () => void;
}) {
  const [relativeDays, setRelativeDays] = useState(initial.relativeDays ?? -3);
  const [subject, setSubject] = useState(initial.subjectTemplate ?? "Invoice {{invoiceNumber}} is due soon");
  const [body, setBody] = useState(initial.bodyTemplate ?? "Hello {{customerName}},\n\nInvoice {{invoiceNumber}} for {{amountDue}} is due on {{dueDate}}.\n\nPay here: {{publicInvoiceUrl}}\n\nThank you,\n{{businessName}}");

  useEffect(() => {
    setRelativeDays(initial.relativeDays ?? -3);
    setSubject(initial.subjectTemplate ?? "Invoice {{invoiceNumber}} is due soon");
    setBody(initial.bodyTemplate ?? "Hello {{customerName}},\n\nInvoice {{invoiceNumber}} for {{amountDue}} is due on {{dueDate}}.\n\nPay here: {{publicInvoiceUrl}}\n\nThank you,\n{{businessName}}");
  }, [initial]);

  if (Object.keys(initial).length === 0) {
    return <Button onClick={() => onSave({ relativeDays: -3, subjectTemplate: subject, bodyTemplate: body })}>Add reminder</Button>;
  }

  return (
    <div>
      <label>
        Timing (days from due, -30 to +60)
        <Input type="number" value={String(relativeDays)} onChange={(e) => setRelativeDays(Number(e.target.value))} />
      </label>
      <label>
        Subject
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </label>
      <label>
        Message (use {"{{customerName}}, {{invoiceNumber}}, {{amountDue}}, {{dueDate}}, {{businessName}}, {{publicInvoiceUrl}}"})
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      <p>
        Preview: {previewReminder(subject, REMINDER_SAMPLE)} — {previewReminder(body, REMINDER_SAMPLE).slice(0, 160)}
      </p>
      <Button onClick={() => onSave({ ...initial, relativeDays, subjectTemplate: subject, bodyTemplate: body })}>Save step</Button>
      <Button onClick={onCancel}>Cancel</Button>
    </div>
  );
}


