"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState, type FormEvent } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Input } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { listCustomers } from "@/features/customers/customers-api";
import type { Customer } from "@/features/customers/types";
import { formatMoney, PageHeader, StatusPanel } from "@/features/invoices/invoice-ui";
import { isApiRequestError } from "@/lib/api";

import { createRecurring } from "./recurring-api";

type LineItem = { description: string; quantity: number; unitPriceKobo: number };

export function RecurringFormPage() {
  return (
    <AppShell>
      {({ accessToken, me }) => <RecurringFormContent accessToken={accessToken} role={me.membership.role} />}
    </AppShell>
  );
}

function RecurringFormContent({ accessToken, role }: { accessToken: string; role: string }) {
  const router = useRouter();
  const canManage = ["owner", "admin", "accountant"].includes(role);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("2026-09-30");
  const [frequency, setFrequency] = useState<"weekly" | "monthly" | "quarterly" | "yearly">("monthly");
  const [dueTermsDays, setDueTermsDays] = useState(14);
  const [endNever, setEndNever] = useState(true);
  const [endDate, setEndDate] = useState("");
  const [autoSend, setAutoSend] = useState(false);
  const [to, setTo] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, unitPriceKobo: 0 }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listCustomers(accessToken, { limit: 100 }).then(
      (res) => setCustomers((res as { customers?: Customer[] }).customers ?? []),
      () => setCustomers([])
    );
  }, [accessToken]);

  const amount = useMemo(
    () => items.reduce((sum, i) => sum + Math.round((Number(i.quantity) || 0) * (Number(i.unitPriceKobo) || 0)), 0),
    [items]
  );

  const duePreview = useMemo(() => {
    const d = new Date(`${startDate}T00:00:00Z`);
    d.setDate(d.getDate() + dueTermsDays);
    return d.toISOString().slice(0, 10);
  }, [startDate, dueTermsDays]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    setError(null);
    if (!customerId) return setError("Choose a customer.");
    if (!name.trim()) return setError("Give the schedule a name.");
    if (items.some((i) => !i.description.trim() || !(i.quantity > 0))) {
      return setError("Each line item needs a description and quantity.");
    }
    setSaving(true);
    try {
      const res = (await createRecurring(accessToken, {
        name: name.trim(),
        customerId,
        startDate,
        frequency,
        endDate: endNever ? null : endDate || null,
        dueTermsDays,
        autoSend,
        ...(to ? { toRecipients: to.split(",").map((s) => s.trim()).filter(Boolean) } : {}),
        lineItems: items
      })) as { schedule?: { id?: string } };
      const id = (res as { schedule?: { id?: string } }).schedule?.id ?? (res as { id?: string }).id;
      router.push(id ? `/recurring-invoices/${id}` : "/recurring-invoices");
    } catch (err) {
      setError(isApiRequestError(err) ? err.message : "Could not save the schedule.");
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) return <EmptyState title="Viewers cannot create recurring schedules" description="Ask an owner, admin, or accountant to create the schedule." />;

  return (
    <div>
      <PageHeader title="Create recurring invoice" description="Bill a customer on a schedule. Uses a price snapshot, not live catalogue pricing." />
      {error && <StatusPanel tone="error" message={error} />}
      <form onSubmit={onSubmit} className="grid gap-6">
        <section>
          <h2>Customer</h2>
          <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Select customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </section>
        <section>
          <h2>Line items</h2>
          {items.map((item, index) => (
            <div key={index} className="grid gap-2">
              <Input
                placeholder="Description"
                value={item.description}
                onChange={(e) => setItems(items.map((it, i) => (i === index ? { ...it, description: e.target.value } : it)))}
              />
              <Input
                type="number"
                placeholder="Qty"
                value={String(item.quantity)}
                onChange={(e) => setItems(items.map((it, i) => (i === index ? { ...it, quantity: Number(e.target.value) } : it)))}
              />
              <Input
                type="number"
                placeholder="Unit price (kobo)"
                value={String(item.unitPriceKobo)}
                onChange={(e) => setItems(items.map((it, i) => (i === index ? { ...it, unitPriceKobo: Number(e.target.value) } : it)))}
              />
            </div>
          ))}
          <Button type="button" onClick={() => setItems([...items, { description: "", quantity: 1, unitPriceKobo: 0 }])}>
            Add line
          </Button>
        </section>
        <section>
          <h2>Schedule</h2>
          <label>
            Schedule name
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Northstar retainer" />
          </label>
          <label>
            Starts
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            Repeats
            <Select value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </label>
          <label>
            Payment terms (days)
            <Input type="number" value={String(dueTermsDays)} onChange={(e) => setDueTermsDays(Number(e.target.value))} />
          </label>
          <div>
            <label>
              <input type="radio" checked={endNever} onChange={() => setEndNever(true)} /> Never
            </label>
            <label>
              <input type="radio" checked={!endNever} onChange={() => setEndNever(false)} /> On date
              {!endNever && <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />}
            </label>
          </div>
        </section>
        <section>
          <h2>Delivery</h2>
          <label>
            <input type="checkbox" checked={autoSend} onChange={(e) => setAutoSend(e.target.checked)} /> Email each invoice automatically
          </label>
          <label>
            To
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="accounts@northstar.example" />
          </label>
        </section>
        <p>
          Next invoice: {startDate} · Due {duePreview} · {formatMoney(amount)}
        </p>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save schedule"}
        </Button>
      </form>
    </div>
  );
}


