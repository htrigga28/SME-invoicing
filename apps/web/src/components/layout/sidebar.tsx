"use client";

import React from "react";

import type { Membership } from "@/features/auth/types";

import { getNavigationItems } from "./navigation";

type SidebarProps = {
  activePath: string;
  role: Membership["role"];
};

export function Sidebar({ activePath, role }: SidebarProps) {
  const items = getNavigationItems(role);

  return (
    <aside className="hidden min-h-screen w-64 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
      <div className="border-b border-slate-200 px-5 py-5">
        <p className="text-sm font-semibold text-slate-950">SME Invoicing</p>
        <p className="mt-1 text-xs text-slate-500">Operations workspace</p>
      </div>
      <nav aria-label="Sidebar navigation" className="flex-1 space-y-1 px-3 py-4">
        {items.map((item) => {
          const isActive = activePath === item.href || activePath.startsWith(`${item.href}/`);

          return (
            <a
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium ${
                isActive
                  ? "bg-teal-50 text-teal-800"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
              }`}
              href={item.href}
              key={item.href}
            >
              <span>{item.label}</span>
              {item.status === "coming-soon" ? (
                <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                  Soon
                </span>
              ) : null}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
