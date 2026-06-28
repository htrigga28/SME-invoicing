"use client";

import React from "react";

import type { Membership } from "@/features/auth/types";

import { AppShell } from "./app-shell";

type ComingSoonPageProps = {
  description: string;
  deniedMessage?: string;
  requiredRoles?: readonly Membership["role"][];
  taskId: string;
  title: string;
};

export function ComingSoonPage({
  deniedMessage,
  description,
  requiredRoles,
  taskId,
  title
}: ComingSoonPageProps) {
  const shellProps = {
    ...(deniedMessage ? { deniedMessage } : {}),
    ...(requiredRoles ? { requiredRoles } : {})
  };

  return (
    <AppShell {...shellProps}>
      {() => (
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-sm font-medium uppercase tracking-wide text-teal-700">{taskId}</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
          <p className="mt-6 inline-flex rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase text-slate-500">
            Coming soon
          </p>
        </section>
      )}
    </AppShell>
  );
}
