"use client";

import React from "react";

import type { MeResponse, Membership } from "@/features/auth/types";

import { getNavigationItems } from "./navigation";

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

export function Topbar({ activePath, me, onLogout }: TopbarProps) {
  const businessName = me.businessProfile.businessName ?? me.activeOrganisation.name;
  const items = getNavigationItems(me.membership.role);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950">{businessName}</p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {me.user.name} · {me.user.email}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
            {roleLabels[me.membership.role]}
          </span>
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
            onClick={onLogout}
            type="button"
          >
            Logout
          </button>
        </div>
      </div>
      <nav
        aria-label="Mobile navigation"
        className="flex gap-2 overflow-x-auto border-t border-slate-100 px-4 py-3 md:hidden"
      >
        {items.map((item) => {
          const isActive = activePath === item.href || activePath.startsWith(`${item.href}/`);

          return (
            <a
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                isActive
                  ? "border-teal-200 bg-teal-50 text-teal-800"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </a>
          );
        })}
      </nav>
    </header>
  );
}
