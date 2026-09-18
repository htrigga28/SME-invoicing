"use client";

import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  CreditCard,
  FileBarChart,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  Search,
  Settings,
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
  products: Package,
  receipts: ReceiptText,
  settings: Settings,
  team: BarChart3
};

export function Topbar({ activePath, me, onLogout }: TopbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);
  const businessName = me.businessProfile.businessName ?? me.activeOrganisation.name;
  const sections = getNavigationSections(me.membership.role);
  const activeItem = sections
    .flatMap((section) => section.items)
    .find((item) => activePath === item.href || activePath.startsWith(`${item.href}/`));

  useEffect(() => {
    if (!accountOpen && !jumpOpen) return;
    function onPointer(e: PointerEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAccountOpen(false);
        setJumpOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen, jumpOpen]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const initials = me.user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--topbar-background)] print:hidden">
      <div className="mx-auto flex min-h-16 w-full max-w-[1600px] items-center gap-3 px-4 lg:px-6">
        <button
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface)] text-[var(--text-secondary)] transition duration-150 hover:border-[var(--border-strong)] md:hidden"
          onClick={() => setMobileOpen((c) => !c)}
          type="button"
        >
          {mobileOpen ? (
            <X aria-hidden="true" className="h-5 w-5" />
          ) : (
            <Menu aria-hidden="true" className="h-5 w-5" />
          )}
        </button>

        <div className="hidden min-w-0 items-center gap-2 text-sm md:flex">
          <span className="truncate font-semibold text-[var(--text-primary)]">{businessName}</span>
          <span aria-hidden="true" className="text-[var(--border-strong)]">/</span>
          <span className="truncate text-[var(--text-secondary)]">{activeItem?.label ?? "Workspace"}</span>
        </div>
        <div className="min-w-0 md:hidden">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
            {activeItem?.label ?? "Workspace"}
          </p>
          <p className="truncate text-xs text-[var(--text-muted)]">{businessName}</p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setJumpOpen((v) => !v)}
            type="button"
            aria-expanded={jumpOpen}
            className="hidden min-h-10 min-w-0 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-muted)] transition duration-150 hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] sm:inline-flex lg:w-72"
          >
            <Search aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="truncate">Search or jump to…</span>
            <kbd className="ml-auto hidden rounded border border-[var(--border-default)] bg-[var(--surface-raised)] px-1.5 text-[11px] lg:inline">⌘K</kbd>
          </button>

          <div className="relative" ref={accountRef}>
            <button
              aria-expanded={accountOpen}
              aria-label="Account menu"
              onClick={() => setAccountOpen((v) => !v)}
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-semibold text-[var(--accent-foreground)] transition duration-150 hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              {initials || "•"}
            </button>
            {accountOpen ? (
              <div
                role="menu"
                aria-label="Account"
                className="absolute right-0 top-12 z-40 w-72 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-overlay)] shadow-[var(--shadow-menu)]"
              >
                <div className="border-b border-[var(--border-subtle)] px-4 py-3">
                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{me.user.name}</p>
                  <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{me.user.email}</p>
                  <p className="mt-2 inline-flex items-center rounded-full bg-[var(--surface-raised)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                    {roleLabels[me.membership.role]} · {businessName}
                  </p>
                </div>
                <div className="p-1.5">
                  <button
                    onClick={onLogout}
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-left text-sm font-semibold text-[var(--text-primary)] transition duration-150 hover:bg-[var(--surface-raised)]"
                  >
                    <LogOut aria-hidden="true" className="h-4 w-4 text-[var(--text-muted)]" />
                    Logout
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {jumpOpen ? (
        <div className="border-t border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3">
          <div className="mx-auto grid w-full max-w-[1600px] gap-1 sm:grid-cols-2 lg:grid-cols-4">
            {sections.flatMap((s) => s.items).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setJumpOpen(false)}
                className="rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition duration-150 hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/invoices/new"
              onClick={() => setJumpOpen(false)}
              className="rounded-[var(--radius-control)] px-3 py-2 text-sm font-semibold text-[var(--accent)] transition duration-150 hover:bg-[var(--accent-muted)]"
            >
              + New invoice
            </Link>
          </div>
        </div>
      ) : null}

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 cursor-default bg-[var(--dialog-backdrop)]"
            onClick={() => setMobileOpen(false)}
            type="button"
            tabIndex={-1}
          />
          <nav
            aria-label="Mobile navigation"
            className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col border-r border-[var(--border-default)] bg-[var(--surface)] shadow-[var(--shadow-dialog)]"
          >
            <div className="flex h-16 items-center justify-between border-b border-[var(--border-subtle)] px-4">
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{businessName}</p>
              <button
                aria-label="Close navigation"
                className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]"
                onClick={() => setMobileOpen(false)}
                type="button"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 py-5">
              {sections.map((section) => (
                <div key={section.label} className="space-y-1.5">
                  <p className="px-2 text-[11px] font-medium tracking-wide text-[var(--text-muted)]">
                    {section.label}
                  </p>
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const isActive =
                        activePath === item.href || activePath.startsWith(`${item.href}/`);
                      const Icon = navigationIcons[item.icon];
                      return (
                        <Link
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-sm text-[var(--text-secondary)] transition duration-150 hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]",
                            isActive && "bg-[var(--accent-muted)] font-semibold text-[var(--accent)]"
                          )}
                          href={item.href}
                          key={item.href}
                          onClick={() => setMobileOpen(false)}
                        >
                          <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-[var(--border-subtle)] p-3">
              <p className="truncate px-2 text-xs text-[var(--text-muted)]">
                {me.user.name} · {roleLabels[me.membership.role]}
              </p>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
