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
        <section className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-6">
          <p className="font-mono text-sm font-medium tabular-nums text-[var(--accent)]">{taskId}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-primary)]">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
          <p className="mt-6 inline-flex rounded-full border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)]">
            Coming soon
          </p>
        </section>
      )}
    </AppShell>
  );
}
