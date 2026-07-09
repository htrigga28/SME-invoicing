import { DEFAULT_CURRENCY, formatKoboToNaira } from "@sme-invoicing/shared";

import { LinkButton } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { MoneyText } from "@/components/ui/typography";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
      <header className="border-b border-[var(--border-subtle)] bg-[var(--topbar-background)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
          <span className="flex items-center gap-3 text-sm font-semibold text-[var(--text-primary)]">
            <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--accent-border-subtle)] bg-[var(--accent-muted)] text-xs font-black text-[var(--accent)]">
              SI
            </span>
            SME Invoicing
          </span>
          <LinkButton href="/login" size="sm" variant="secondary">
            Login
          </LinkButton>
        </div>
      </header>
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col justify-center gap-8 px-6 py-12">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase text-[var(--accent)]">
            Financial operations workspace
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-[var(--text-primary)] sm:text-5xl">
            SME Invoice & Payment Reconciliation Platform
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--text-secondary)]">
            Create invoices, reconcile Paystack payments, issue receipts, and export operational
            records from one dense command center for Nigerian SMEs.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <LinkButton href="/login">Open workspace</LinkButton>
            <LinkButton href="/register" variant="outline">
              Create account
            </LinkButton>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <SectionCard>
            <p className="text-sm text-[var(--text-muted)]">Default currency</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
              {DEFAULT_CURRENCY}
            </p>
          </SectionCard>
          <SectionCard>
            <p className="text-sm text-[var(--text-muted)]">Money storage</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">Integer kobo</p>
          </SectionCard>
          <SectionCard>
            <p className="text-sm text-[var(--text-muted)]">Formatting check</p>
            <MoneyText className="mt-2 block text-2xl">{formatKoboToNaira(125000)}</MoneyText>
          </SectionCard>
        </div>
      </section>
    </main>
  );
}
