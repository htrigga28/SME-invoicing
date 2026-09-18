"use client";

import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
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
  const descriptionId = useId();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = ref.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.open = true;
    }
    document.body.style.overflow = "hidden";
    return () => {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.open = false;
      }
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        "fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-md border-0 bg-[var(--surface)] p-0 text-[var(--text-primary)] shadow-[var(--shadow-dialog)] backdrop:bg-[var(--dialog-backdrop)]",
        wide && "max-w-2xl"
      )}
    >
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="break-words text-lg font-semibold">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-[var(--text-secondary)]">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton
            aria-label="Close panel"
            onClick={onClose}
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">{children}</div>
      </div>
    </dialog>
  );
}

export const Sheet = Drawer;
