"use client";

import React, { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";

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
  return (
    <DropdownMenu
      label={label}
      items={items}
      trigger={<MoreHorizontal aria-hidden="true" className="h-5 w-5" />}
      compact
    />
  );
}

export function DropdownMenu({
  trigger,
  items,
  align = "right",
  label,
  compact = false
}: {
  trigger: React.ReactNode;
  items: MenuItem[];
  align?: "left" | "right";
  label: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  useLayoutEffect(() => {
    if (!open) return;
    const menu = menuRef.current!;
    const triggerRect = buttonRef.current!.getBoundingClientRect();
    const left = align === "right" ? triggerRect.right - menu.offsetWidth : triggerRect.left;
    menu.style.left = `${Math.max(8, Math.min(left, window.innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.max(8, triggerRect.bottom + menu.offsetHeight + 8 > window.innerHeight ? triggerRect.top - menu.offsetHeight - 4 : triggerRect.bottom + 4)}px`;
    menu.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
    function outside(event: PointerEvent) {
      if (
        !menu.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      )
        setOpen(false);
    }
    function reposition() {
      setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, align]);

  return (
    <div
      className="inline-flex"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
          compact ? "w-11" : "gap-2 border border-[var(--border-default)] bg-[var(--surface)] px-3"
        )}
      >
        {trigger}
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              id={id}
              role="menu"
              aria-label={label}
              className="fixed z-[60] max-h-[calc(100dvh-16px)] min-w-48 max-w-[calc(100vw-16px)] overflow-y-auto rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-overlay)] p-1 shadow-[var(--shadow-menu)]"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  close();
                }
                if (event.key === "Tab") close();
                if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                  event.preventDefault();
                  const entries = Array.from(
                    menuRef.current!.querySelectorAll<HTMLElement>(
                      '[role="menuitem"]:not(:disabled)'
                    )
                  );
                  const index = entries.indexOf(document.activeElement as HTMLElement);
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? entries.length - 1
                        : (index + (event.key === "ArrowDown" ? 1 : -1) + entries.length) %
                          entries.length;
                  entries[next]?.focus();
                }
              }}
            >
              {items.map((item) => {
                const className = cn(
                  "flex min-h-11 w-full items-center rounded px-3 py-2 text-left text-sm outline-none hover:bg-[var(--surface-raised)] focus:bg-[var(--surface-selected)] disabled:opacity-50",
                  item.destructive ? "text-[var(--danger)]" : "text-[var(--text-primary)]"
                );
                return item.href && !item.disabled ? (
                  <a
                    key={item.label}
                    role="menuitem"
                    className={className}
                    href={item.href}
                    onClick={close}
                  >
                    {item.label}
                  </a>
                ) : (
                  <button
                    key={item.label}
                    role="menuitem"
                    type="button"
                    className={className}
                    disabled={item.disabled}
                    onClick={() => {
                      close();
                      item.onSelect?.();
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
