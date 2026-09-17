"use client";

import React, { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/cn";

import { IconButton } from "./button";

type MenuItem = {
  label: string;
  href?: string;
  onSelect?: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

export function TableRowActionMenu({
  label = "Row actions",
  items
}: {
  label?: string;
  items: MenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointer(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open ]);

  return (
    <div className="relative inline-flex justify-end" ref={containerRef}>
      <IconButton
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-label={label}
        className="h-9 w-9 border border-transparent text-[var(--text-secondary)] hover:border-[var(--border-default)] hover:bg-[var(--surface-raised)]"
        onClick={() => setOpen((v) => !v)}
        type="button"
        variant="ghost"
      >
        <span aria-hidden="true" className="text-base leading-none tracking-widest">
          •••
        </span>
      </IconButton>
      {open ? (
        <div
          className="absolute right-0 top-10 z-30 min-w-44 overflow-hidden rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-overlay)] py-1 shadow-[var(--shadow-menu)]"
          id={menuId}
          role="menu"
        >
          {items.map((item) => (
            <MenuRow
              key={item.label}
              item={item}
              onDone={() => setOpen(false)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MenuRow({ item, onDone }: { item: MenuItem; onDone: () => void }) {
  const className = cn(
    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition duration-150",
    item.destructive
      ? "text-[var(--danger)] hover:bg-[var(--danger-muted)]"
      : "text-[var(--text-primary)] hover:bg-[var(--surface-raised)]",
    item.disabled && "cursor-not-allowed opacity-50"
  );

  if (item.href && !item.disabled) {
    return (
      <a className={className} href={item.href} role="menuitem" onClick={onDone}>
        {item.label}
      </a>
    );
  }

  return (
    <button
      className={className}
      disabled={item.disabled}
      onClick={() => {
        onDone();
        item.onSelect?.();
      }}
      role="menuitem"
      type="button"
    >
      {item.label}
    </button>
  );
}

export function DropdownMenu({
  trigger,
  items,
  align = "right",
  label
}: {
  trigger: React.ReactNode;
  items: MenuItem[];
  align?: "left" | "right";
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        type="button"
        className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] transition duration-150 hover:border-[var(--border-strong)]"
      >
        {trigger}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className={cn(
            "absolute top-11 z-30 min-w-48 overflow-hidden rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-overlay)] py-1 shadow-[var(--shadow-menu)]",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {items.map((item) => (
            <MenuRow key={item.label} item={item} onDone={() => setOpen(false)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
