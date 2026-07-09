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
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  UserRound,
  UsersRound,
  X,
  type LucideIcon
} from "lucide-react";

import type { MeResponse, Membership } from "@/features/auth/types";
import { cn } from "@/lib/cn";

import { getNavigationSections, type AppRoute } from "./navigation";

type TopbarProps = {
  activePath: string;
  me: MeResponse;
  onLogout: () => void;
};

const roleLabels: Record<Membership["role"], string> = {
  owner: "Owner",
  admin: "Admin",
  accountant: "Accountant",
  viewer: "Viewer"
};

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

export function Topbar({ activePath, me, onLogout }: TopbarProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const businessName = me.businessProfile.businessName ?? me.activeOrganisation.name;
  const sections = getNavigationSections(me.membership.role);
  const activeItem = sections
    .flatMap((section) => section.items)
    .find((item) => activePath === item.href || activePath.startsWith(`${item.href}/`));

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--topbar-background)] backdrop-blur-xl print:hidden">
      <div className="mx-auto flex min-h-16 w-full max-w-[1440px] items-center justify-between gap-3 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] text-[var(--text-secondary)] md:hidden"
            onClick={() => setMobileOpen((current) => !current)}
            type="button"
          >
            {mobileOpen ? (
              <X aria-hidden="true" className="h-5 w-5" />
            ) : (
              <Menu aria-hidden="true" className="h-5 w-5" />
            )}
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
              {businessName}
            </p>
            <p className="mt-1 hidden truncate text-xs text-[var(--text-muted)] sm:block">
              {me.user.name} · {me.user.email}
            </p>
            <p className="mt-1 truncate text-xs font-semibold text-[var(--accent)] sm:hidden">
              {activeItem?.label ?? "Workspace"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-[var(--accent-border-subtle)] bg-[var(--accent-muted)] px-3 py-1 text-xs font-semibold text-[var(--accent)] sm:inline-flex">
            <UserRound aria-hidden="true" className="h-3.5 w-3.5" />
            {roleLabels[me.membership.role]}
          </span>
          <button
            aria-label="Logout"
            className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--hover-subtle)] hover:text-[var(--text-primary)]"
            onClick={onLogout}
            type="button"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      <nav
        aria-label="Mobile navigation"
        className={cn(
          "border-t border-[var(--border-subtle)] bg-[var(--background-deep)] px-4 py-4 md:hidden",
          mobileOpen ? "block" : "hidden"
        )}
      >
        <div className="space-y-5">
          {sections.map((section) => (
            <div key={section.label}>
              <p className="text-xs font-semibold uppercase text-[var(--text-muted)]">
                {section.label}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {section.items.map((item) => {
                  const isActive =
                    activePath === item.href || activePath.startsWith(`${item.href}/`);
                  const Icon = navigationIcons[item.icon];

                  return (
                    <Link
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)]",
                        isActive &&
                          "border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--accent)]"
                      )}
                      href={item.href}
                      key={item.href}
                      onClick={() => setMobileOpen(false)}
                    >
                      <Icon aria-hidden="true" className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </header>
  );
}
