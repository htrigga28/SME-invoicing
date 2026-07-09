import { BusinessOnboardingForm } from "@/features/onboarding/business-onboarding-form";

export default function BusinessOnboardingPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10 text-[var(--text-primary)] sm:px-6">
      <section className="mx-auto max-w-2xl">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--accent-border-subtle)] bg-[var(--accent-muted)] text-sm font-black text-[var(--accent)]">
          SI
        </div>
        <p className="text-xs font-semibold uppercase text-[var(--accent)]">Business onboarding</p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">
          Complete your business profile
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
          This profile appears on invoices and receipts. After it is complete, activate Payment
          Setup to accept online payments.
        </p>
        <div className="mt-8">
          <BusinessOnboardingForm />
        </div>
      </section>
    </main>
  );
}
