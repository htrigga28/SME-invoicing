"use client";

import React, { useId, type ReactNode } from "react";

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

  const confirmClassName = destructive
    ? "bg-red-700 text-white hover:bg-red-800 disabled:bg-red-300"
    : "bg-teal-700 text-white hover:bg-teal-800 disabled:bg-slate-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
        role="dialog"
      >
        <h2 className="text-lg font-semibold text-slate-950" id={titleId}>
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600" id={descriptionId}>
          {description}
        </p>
        {children ? <div className="mt-4">{children}</div> : null}

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            aria-label={cancelLabel}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
            disabled={isLoading}
            onClick={onCancel}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            aria-label={confirmLabel}
            className={`rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed ${confirmClassName}`}
            disabled={isLoading}
            onClick={onConfirm}
            type="button"
          >
            {isLoading ? (loadingLabel ?? "Working...") : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
