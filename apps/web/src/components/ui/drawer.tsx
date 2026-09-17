"use client";

import React, { useEffect, useId } from "react";

import { cn } from "@/lib/cn";

import { IconButton } from "./button";

export function Drawer({
  children,
  onClose,
  open,
  title,
  description,
  wide = false
}: {
  children: React.ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
  description?: string;
  wide?: boolean;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        aria-label="Close panel"
        className="absolute inset-0 cursor-default bg-[var(--dialog-backdrop)]"
        onClick={onClose}
        type="button"
        tabIndex={-1}
      />
      <section
        className={cn(
          "absolute inset-y-0 right-0 flex w-full flex-col border-l border-[var(--border-default)] bg-[var(--surface)] shadow-[var(--shadow-dialog)]",
          wide ? "max-w-2xl" : "max-w-md"
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-base font-semibold text-[var(--text-primary)]">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
            ) : null}
          </div>
          <IconButton aria-label="Close panel" onClick={onClose} type="button" variant="ghost" className="h-9 w-9">
            <span aria-hidden="true" className="text-lg leading-none">×</span>
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </section>
    </div>
  );
}

export function Sheet({
  children,
  onClose,
  open,
  title
}: {
  children: React.ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        aria-label="Close dialog"
        className="absolute inset-0 cursor-default bg-[var(--dialog-backdrop)]"
        onClick={onClose}
        type="button"
        tabIndex={-1}
      />
      <section className="relative w-full max-w-lg rounded-t-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface)] p-5 shadow-[var(--shadow-dialog)] sm:rounded-[var(--radius-card)]">
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
          <IconButton aria-label="Close dialog" onClick={onClose} type="button" variant="ghost" className="h-9 w-9">
            <span aria-hidden="true" className="text-lg leading-none">×</span>
          </IconButton>
        </div>
        <div className="mt-4">{children}</div>
      </section>
    </div>
  );
}
