"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState, type FormEvent } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Input } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { listCustomers } from "@/features/customers/customers-api";
import type { Customer } from "@/features/customers/types";
import { formatMoney, PageHeader, StatusPanel } from "@/features/invoices/invoice-ui";
import { isApiRequestError } from "@/lib/api";
import { lagosBusinessDate } from "@/lib/business-date";

import { createRecurring, getRecurring, updateRecurring } from "./recurring-api";

type LineItem = { description: string; quantity: number; unitPrice: string };

export function RecurringFormPage({ scheduleId }: { scheduleId?: string }) {
  return (
    <AppShell>
      {({ accessToken, me }) => <RecurringFormContent accessToken={accessToken} role={me.membership.role} {...(scheduleId ? { scheduleId } : {})} />}
    </AppShell>
  );
}

export function RecurringFormContent({ accessToken, role, scheduleId }: { accessToken: string; role: string; scheduleId?: string }) {
  const router = useRouter();
  const canManage = ["owner", "admin", "accountant"].includes(role);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(lagosBusinessDate);
  const [nextIssueDate, setNextIssueDate] = useState("");
  const [frequency, setFrequency] = useState<"weekly" | "monthly" | "quarterly" | "yearly">("monthly");
  const [dueTermsDays, setDueTermsDays] = useState(14);
  const [endNever, setEndNever] = useState(true);
  const [endDate, setEndDate] = useState("");
  const [autoSend, setAutoSend] = useState(false);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, unitPrice: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(scheduleId));

  useEffect(() => {
    listCustomers(accessToken, { limit: 100 }).then(
      (res) => setCustomers((res as { customers?: Customer[] }).customers ?? []),
      () => setCustomers([])
    );
  }, [accessToken]);
  useEffect(() => {
    if (!scheduleId) return;
    getRecurring(accessToken, scheduleId).then((res) => {
      const data = res as { schedule: { customerId: string; name: string; startDate: string; nextIssueDate: string; frequency: typeof frequency; dueTermsDays: number; endDate: string | null; autoSend: boolean; toRecipients: string[]; ccRecipients: string[]; emailSubject: string | null; discountKobo: number; taxKobo: number }; lineItems: { description: string; quantity: string | number; unitPriceKobo: number }[] };
      const s = data.schedule;
      setCustomerId(s.customerId); setName(s.name); setStartDate(s.startDate); setNextIssueDate(s.nextIssueDate); setFrequency(s.frequency);
      setDueTermsDays(s.dueTermsDays); setEndNever(!s.endDate); setEndDate(s.endDate ?? "");
      setAutoSend(s.autoSend); setTo(s.toRecipients.join(", ")); setCc(s.ccRecipients.join(", "));
      setEmailSubject(s.emailSubject ?? ""); setDiscount((s.discountKobo / 100).toFixed(2)); setTax((s.taxKobo / 100).toFixed(2));
      setItems(data.lineItems.map((item) => ({ description: item.description, quantity: Number(item.quantity), unitPrice: (item.unitPriceKobo / 100).toFixed(2) })));
    }).catch((err) => setError(isApiRequestError(err) ? err.message : "Could not load schedule.")).finally(() => setLoading(false));
  }, [accessToken, scheduleId]);

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + Math.round((Number(i.quantity) || 0) * Math.round(Number(i.unitPrice) * 100)), 0),
    [items]
  );
  const amount = subtotal - Math.round(Number(discount) * 100) + Math.round(Number(tax) * 100);

  const duePreview = useMemo(() => {
    const issueDate = scheduleId ? nextIssueDate : startDate;
    if (!issueDate) return "";
    const d = new Date(`${issueDate}T00:00:00Z`);
    d.setDate(d.getDate() + dueTermsDays);
    return d.toISOString().slice(0, 10);
  }, [startDate, nextIssueDate, scheduleId, dueTermsDays]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    setError(null);
    if (!customerId) return setError("Choose a customer.");
    if (!name.trim()) return setError("Give the schedule a name.");
    if (scheduleId && !to.split(",").some((address) => address.trim())) return setError("Enter at least one recipient.");
    if (!scheduleId && startDate < lagosBusinessDate()) return setError("Start date cannot be in the past.");
    if (!endNever && (!endDate || endDate < (scheduleId ? nextIssueDate : startDate))) return setError("End date must be on or after the next issue date.");
    if (items.some((i) => !i.description.trim() || !Number.isFinite(i.quantity) || i.quantity <= 0 || Math.abs(i.quantity * 100 - Math.round(i.quantity * 100)) > 0.000001 || !Number.isFinite(Number(i.unitPrice)) || Number(i.unitPrice) < 0 || !/^\d+(\.\d{1,2})?$/.test(i.unitPrice))) {
      return setError("Each line needs a description, quantity with up to two decimals, and valid currency price.");
    }
    if (!Number.isInteger(dueTermsDays) || dueTermsDays < 0 || dueTermsDays > 120) return setError("Payment terms must be between 0 and 120 days.");
    if (!Number.isFinite(amount) || amount < 0 || !/^\d+(\.\d{1,2})?$/.test(discount) || !/^\d+(\.\d{1,2})?$/.test(tax)) return setError("Check the discount, tax, and total.");
    setSaving(true);
    try {
      const input = {
        name: name.trim(),
        frequency,
        endDate: endNever ? null : endDate || null,
        dueTermsDays,
        autoSend,
        ...(to ? { toRecipients: to.split(",").map((s) => s.trim()).filter(Boolean) } : {}),
        ccRecipients: cc.split(",").map((s) => s.trim()).filter(Boolean),
        emailSubject: emailSubject.trim() || null,
        discountKobo: Math.round(Number(discount) * 100),
        taxKobo: Math.round(Number(tax) * 100),
        lineItems: items.map(({ description, quantity, unitPrice }) => ({ description: description.trim(), quantity, unitPriceKobo: Math.round(Number(unitPrice) * 100) }))
      };
      const res = (scheduleId ? await updateRecurring(accessToken, scheduleId, input) : await createRecurring(accessToken, { ...input, customerId, startDate })) as { schedule?: { id?: string } };
      const id = scheduleId ?? (res as { schedule?: { id?: string } }).schedule?.id ?? (res as { id?: string }).id;
      router.push(id ? `/recurring-invoices/${id}` : "/recurring-invoices");
    } catch (err) {
      setError(isApiRequestError(err) ? err.message : "Could not save the schedule.");
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) return <EmptyState title="Viewers cannot create recurring schedules" description="Ask an owner, admin, or accountant to create the schedule." />;
  if (loading) return <p>Loading schedule…</p>;

  return (
    <div>
      <PageHeader title={scheduleId ? "Edit recurring invoice" : "Create recurring invoice"} description="Bill a customer on a schedule. Uses a price snapshot, not live catalogue pricing." />
      {error && <StatusPanel tone="error" message={error} />}
      <form onSubmit={onSubmit} className="grid min-w-0 gap-5">
        <SectionCard className="space-y-3">
          <h2 className="font-semibold">Customer</h2>
          <Select className="min-h-11!" aria-label="Customer" value={customerId} disabled={Boolean(scheduleId)} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Select customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </SectionCard>
        <SectionCard className="space-y-4">
          <h2 className="font-semibold">Line items</h2>
          {items.map((item, index) => (
            <div key={index} className="grid min-w-0 gap-3 rounded-[var(--radius-card)] border border-[var(--border-subtle)] p-3 sm:grid-cols-[minmax(0,1fr)_90px_150px_auto] sm:items-end">
              <label className="min-w-0 space-y-1 text-sm">Description
              <Input
                className="min-h-11!"
                placeholder="Description"
                value={item.description}
                onChange={(e) => setItems(items.map((it, i) => (i === index ? { ...it, description: e.target.value } : it)))}
              /></label>
              <label className="space-y-1 text-sm">Quantity
              <Input
                className="min-h-11!"
                type="number"
                min="0.01"
                step="any"
                placeholder="Qty"
                value={String(item.quantity)}
                onChange={(e) => setItems(items.map((it, i) => (i === index ? { ...it, quantity: Number(e.target.value) } : it)))}
              /></label>
              <label className="space-y-1 text-sm">Unit price (₦)
              <Input
                className="min-h-11!"
                type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00"
                value={item.unitPrice}
                onChange={(e) => setItems(items.map((it, i) => (i === index ? { ...it, unitPrice: e.target.value } : it)))}
              /></label>
              <div className="flex flex-wrap items-center justify-between gap-2 sm:block"><p className="text-sm font-semibold">{formatMoney(Math.round(item.quantity * Math.round(Number(item.unitPrice) * 100)))}</p><Button size="lg" type="button" variant="ghost" disabled={items.length === 1} onClick={() => setItems(items.filter((_, i) => i !== index))}>Remove</Button></div>
            </div>
          ))}
          <Button size="lg" type="button" variant="secondary" onClick={() => setItems([...items, { description: "", quantity: 1, unitPrice: "" }])}>
            Add line
          </Button>
          <div className="grid gap-3 border-t border-[var(--border-subtle)] pt-3 sm:grid-cols-2"><label className="space-y-1 text-sm">Discount (₦)<Input className="min-h-11!" type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} /></label><label className="space-y-1 text-sm">Tax (₦)<Input className="min-h-11!" type="number" min="0" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} /></label></div>
          <div className="space-y-1 text-right text-sm"><p>Subtotal {formatMoney(subtotal)}</p><p>Discount −{formatMoney(Math.round(Number(discount) * 100))}</p><p>Tax +{formatMoney(Math.round(Number(tax) * 100))}</p><p className="text-lg font-semibold">Total {formatMoney(amount)}</p></div>
        </SectionCard>
        <SectionCard className="grid gap-4 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Schedule</h2>
          <label>
            Schedule name
            <Input className="min-h-11!" value={name} onChange={(e) => setName(e.target.value)} placeholder="Northstar retainer" />
          </label>
          <label>
            Starts
            <Input className="min-h-11!" type="date" min={scheduleId ? undefined : lagosBusinessDate()} disabled={Boolean(scheduleId)} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            Repeats
            <Select className="min-h-11!" value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </label>
          <label>
            Payment terms (days)
            <Input className="min-h-11!" type="number" min="0" value={String(dueTermsDays)} onChange={(e) => setDueTermsDays(Number(e.target.value))} />
          </label>
          <div>
            <label className="inline-flex min-h-11 items-center gap-2 pr-4">
              <input className="h-4 w-4 min-h-0! shrink-0" type="radio" name="endCondition" checked={endNever} onChange={() => setEndNever(true)} /> Never
            </label>
            <label className="inline-flex min-h-11 flex-wrap items-center gap-2">
              <input className="h-4 w-4 min-h-0! shrink-0" type="radio" name="endCondition" checked={!endNever} onChange={() => setEndNever(false)} /> On date
            </label>
            {!endNever && <label className="block space-y-1 text-sm">End date<Input className="min-h-11!" type="date" min={scheduleId ? nextIssueDate : startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>}
          </div>
        </SectionCard>
        <SectionCard className="grid gap-4 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Delivery</h2>
          <label className="flex min-h-11 items-center gap-2">
            <input className="h-4 w-4 min-h-0! shrink-0" type="checkbox" checked={autoSend} onChange={(e) => setAutoSend(e.target.checked)} /> Email each invoice automatically
          </label>
          <p className="text-sm text-[var(--text-secondary)] sm:col-span-2">When on, Lumina emails each new invoice during the daily automation window.</p>
          <label>
            To
            <Input className="min-h-11!" value={to} onChange={(e) => setTo(e.target.value)} placeholder="accounts@northstar.example" />
          </label>
          <label>CC<Input className="min-h-11!" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="finance@example.com" /></label>
          <label className="sm:col-span-2">Email subject<Input className="min-h-11!" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Optional custom subject" /></label>
          <p className="text-xs text-[var(--text-secondary)] sm:col-span-2">Separate multiple email addresses with commas. {scheduleId ? "Enter at least one To recipient for this schedule." : "If To is empty, the customer email is used."}</p>
        </SectionCard>
        <p>
          Next invoice: {scheduleId ? nextIssueDate : startDate} · Due {duePreview} · {formatMoney(amount)}
        </p>
        <Button size="lg" type="submit" disabled={saving}>
          {saving ? "Saving…" : scheduleId ? "Save changes" : "Save schedule"}
        </Button>
      </form>
    </div>
  );
}


