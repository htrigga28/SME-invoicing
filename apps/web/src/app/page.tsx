import { DEFAULT_CURRENCY, formatKoboToNaira } from "@sme-invoicing/shared";

import { AppShell } from "@/components/layout/app-shell";

export default function HomePage() {
  return (
    <AppShell>
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col justify-center gap-8 px-6 py-12">
        <div className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-wide text-teal-700">T002 setup</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
            SME Invoice & Payment Reconciliation Platform
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
            Monorepo foundation is ready for the finance operations workspace. Product workflows
            such as auth, customers, invoices, payments, and receipts will be implemented in later
            task branches.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Default currency</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{DEFAULT_CURRENCY}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Money storage</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">Integer kobo</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Formatting check</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {formatKoboToNaira(125000)}
            </p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
