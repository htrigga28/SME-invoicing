"use client";

import { AppShell } from "@/components/layout/app-shell";

export function DashboardShell() {
  return (
    <AppShell>
      {({ me }) => (
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-teal-700">Dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">
              {me.businessProfile.businessName ?? me.activeOrganisation.name}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Auth, tenant context, RBAC foundation, business onboarding, and team management are
              active. Dashboard metrics will be implemented in T012.
            </p>
          </div>
        </section>
      )}
    </AppShell>
  );
}
