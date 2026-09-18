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
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Settings,
  UsersRound,
  type LucideIcon
} from "lucide-react";

import { BrandMark } from "@/components/brand/brand-logo";
import type { Membership } from "@/features/auth/types";
import { cn } from "@/lib/cn";

import { getNavigationSections, type AppRoute } from "./navigation";

type SidebarProps = {
  activePath: string;
  expanded?: boolean;
  onToggle?: () => void;
  role: Membership["role"];
};

export function Sidebar({ activePath, expanded = false, onToggle, role }: SidebarProps) {
  const sections = getNavigationSections(role);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden shrink-0 overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--surface)] print:hidden md:flex md:flex-col",
        "transition-[width] duration-150 ease-out",
        expanded ? "w-60" : "w-20"
      )}
      data-expanded={expanded ? "true" : "false"}
    >
      <div
        className={cn(
          "flex border-b border-[var(--border-subtle)]",
          expanded
            ? "h-16 items-center justify-between gap-3 px-4"
            : "min-h-16 flex-col items-center justify-center gap-2 px-1 py-3"
        )}
      >
        <Link
          aria-label="Lumina overview"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent)] text-[var(--accent-foreground)]"
          href="/dashboard"
        >
          <BrandMark className="h-7 w-7" />
        </Link>
        {expanded ? (
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-primary)]">
            Lumina
          </span>
        ) : null}
        {onToggle ? (
          <button
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-muted)] transition duration-150 hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            onClick={onToggle}
            type="button"
          >
            {expanded ? (
              <PanelLeftClose aria-hidden="true" className="h-4 w-4" />
            ) : (
              <PanelLeftOpen aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
        ) : null}
      </div>
      <nav
        aria-label="Sidebar navigation"
        className="min-w-0 flex-1 space-y-6 overflow-x-hidden overflow-y-auto px-3 py-5"
      >
        {sections.map((section) => (
          <div className="space-y-1.5" key={section.label}>
            <p
              className={cn(
                "text-[11px] font-medium tracking-wide text-[var(--text-muted)]",
                expanded ? "px-2" : "text-center"
              )}
            >
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = activePath === item.href || activePath.startsWith(`${item.href}/`);
                const Icon = navigationIcons[item.icon];

                return (
                  <Link
                    aria-label={item.label}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group relative flex h-10 items-center rounded-[var(--radius-control)] text-[var(--text-secondary)] transition duration-150 hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
                      expanded ? "w-full gap-3 px-3" : "w-14 justify-center",
                      isActive && "bg-[var(--accent-muted)] font-semibold text-[var(--accent)]"
                    )}
                    href={item.href}
                    key={item.href}
                    title={item.label}
                  >
                    {isActive && expanded ? (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[var(--accent)]"
                      />
                    ) : null}
                    <Icon aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.9} />
                    <span className={expanded ? "truncate text-sm" : "sr-only"}>
                      {item.label}
                    </span>
                    {!expanded ? (
                      <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-overlay)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] opacity-0 shadow-[var(--shadow-menu)] transition duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                        {item.label}
                      </span>
                    ) : null}
                    {item.status === "coming-soon" ? (
                      <span className="absolute right-1 top-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-1 text-[9px] font-semibold uppercase text-[var(--text-muted)]">
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
  products: Package,
  receipts: ReceiptText,
  settings: Settings,
  team: BarChart3
};
