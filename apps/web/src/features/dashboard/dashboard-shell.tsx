"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import type { Membership } from "@/features/auth/types";
import { clearStoredSession } from "@/features/auth/session";
import { getPaymentSetupAccount } from "@/features/payment-setup/payment-setup-api";
import type { PaymentSetupAccountResponse } from "@/features/payment-setup/types";
import { canManagePaymentSetup } from "@/features/payment-setup/types";
import { isApiRequestError } from "@/lib/api";

export function DashboardShell() {
  return (
    <AppShell>
      {({ accessToken, me }) => (
        <DashboardContent
          accessToken={accessToken}
          businessName={me.businessProfile.businessName ?? me.activeOrganisation.name}
          role={me.membership.role}
        />
      )}
    </AppShell>
  );
}

function DashboardContent({
  accessToken,
  businessName,
  role
}: {
  accessToken: string;
  businessName: string;
  role: Membership["role"];
}) {
  const [paymentSetup, setPaymentSetup] = useState<PaymentSetupAccountResponse | null>(null);

  useEffect(() => {
    getPaymentSetupAccount(accessToken)
      .then(setPaymentSetup)
      .catch((error) => {
        if (isApiRequestError(error) && error.status === 401) {
          clearStoredSession();
          window.location.assign("/login");
        }
      });
  }, [accessToken]);

  const showPaymentSetupPrompt =
    canManagePaymentSetup(role) && paymentSetup !== null && paymentSetup.status !== "active";

  return (
    <section className="space-y-5">
      {showPaymentSetupPrompt ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            Payment Setup Required
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">
            Online payments are not active yet
          </h2>
          <p className="mt-2 max-w-2xl leading-6">
            Complete Payment Setup so customers can pay invoices online. You can still create and
            send invoices before payouts are configured.
          </p>
          <Link
            className="mt-4 inline-flex rounded-md bg-slate-950 px-4 py-2 font-medium text-white hover:bg-slate-800"
            href="/settings/payment-setup"
          >
            Set up payments
          </Link>
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-teal-700">Dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{businessName}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Auth, tenant context, RBAC foundation, business onboarding, team management, and Payment
            Setup are active. Dashboard metrics will be implemented in T015.
          </p>
        </div>
      </section>
    </section>
  );
}
