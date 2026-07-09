"use client";

import React, { useId, type ReactNode } from "react";

import { Button } from "./button";

type ConfirmDialogProps = {
  cancelLabel?: string;
  confirmLabel: string;
  description: string;
  destructive?: boolean;
  children?: ReactNode;
  isLoading?: boolean;
  loadingLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
};

export function ConfirmDialog({
  cancelLabel = "Cancel",
  children,
  confirmLabel,
  description,
  destructive = false,
  isLoading = false,
  loadingLabel,
  onCancel,
  onConfirm,
  open,
  title
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--dialog-backdrop)] px-4 py-6 backdrop-blur-sm">
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-overlay)] p-5"
        role="dialog"
      >
        <h2 className="text-lg font-semibold text-[var(--text-primary)]" id={titleId}>
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]" id={descriptionId}>
          {description}
        </p>
        {children ? <div className="mt-4">{children}</div> : null}

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button disabled={isLoading} onClick={onCancel} type="button" variant="outline">
            {cancelLabel}
          </Button>
          <Button
            isLoading={isLoading}
            loadingLabel={loadingLabel}
            onClick={onConfirm}
            type="button"
            variant={destructive ? "destructive" : "primary"}
          >
            {confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}
