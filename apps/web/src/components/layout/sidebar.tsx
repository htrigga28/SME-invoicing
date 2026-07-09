"use client";

import Link from "next/link";
import React from "react";
import {
  Activity,
  BarChart3,
  CreditCard,
  FileBarChart,
  FileText,
  LayoutDashboard,
  ReceiptText,
  Settings,
  UsersRound,
  type LucideIcon
} from "lucide-react";

import type { Membership } from "@/features/auth/types";
import { cn } from "@/lib/cn";

import { getNavigationSections, type AppRoute } from "./navigation";

type SidebarProps = {
  activePath: string;
  role: Membership["role"];
};

export function Sidebar({ activePath, role }: SidebarProps) {
  const sections = getNavigationSections(role);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-20 shrink-0 border-r border-[var(--border-subtle)] bg-[var(--background-deep)] print:hidden md:flex md:flex-col">
      <div className="flex h-16 items-center justify-center border-b border-[var(--border-subtle)]">
        <Link
          aria-label="SME Invoicing dashboard"
          className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] border border-[var(--accent-border-subtle)] bg-[var(--accent-muted)] text-sm font-black text-[var(--accent)]"
          href="/dashboard"
        >
          SI
        </Link>
      </div>
      <nav aria-label="Sidebar navigation" className="flex-1 space-y-7 px-3 py-5">
        {sections.map((section) => (
          <div className="space-y-2" key={section.label}>
            <p className="text-center text-[10px] font-semibold uppercase text-[var(--text-muted)]">
              {section.label}
            </p>
            <div className="space-y-1.5">
              {section.items.map((item) => {
                const isActive = activePath === item.href || activePath.startsWith(`${item.href}/`);
                const Icon = navigationIcons[item.icon];

                return (
                  <Link
                    aria-label={item.label}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group relative flex h-11 w-14 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-muted)] transition duration-200 hover:bg-[var(--hover-subtle)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
                      isActive &&
                        "bg-[var(--accent-muted)] text-[var(--accent)] [box-shadow:0_0_24px_var(--accent-glow)]"
                    )}
                    href={item.href}
                    key={item.href}
                    title={item.label}
                  >
                    <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.9} />
                    <span className="sr-only">{item.label}</span>
                    <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] opacity-0 shadow-none transition duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                      {item.label}
                    </span>
                    {item.status === "coming-soon" ? (
                      <span className="absolute right-1 top-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-1 text-[9px] font-semibold uppercase text-[var(--text-muted)]">
                        Soon
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

const navigationIcons: Record<AppRoute["icon"], LucideIcon> = {
  audit: Activity,
  customers: UsersRound,
  dashboard: LayoutDashboard,
  exports: FileBarChart,
  invoices: FileText,
  payments: CreditCard,
  receipts: ReceiptText,
  settings: Settings,
  team: BarChart3
};
