"use client";

import React, { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";

export type SendInvoiceFormInput = {
  to: string[];
  cc: string[];
  subject: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmailList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function validateSendForm(to: string, cc: string): string | null {
  const toList = parseEmailList(to);

  if (toList.length === 0) {
    return "Enter at least one recipient email address.";
  }

  const ccList = parseEmailList(cc).filter((email) => !toList.includes(email));
  const invalid = [...toList, ...ccList].find(
    (email) => email.length > 320 || !EMAIL_PATTERN.test(email)
  );

  if (invalid) {
    return `"${invalid}" is not a valid email address.`;
  }

  if (toList.length + ccList.length > 10) {
    return "No more than 10 recipients are allowed.";
  }

  return null;
}

export function SendInvoiceDialog({
  defaultSubject,
  defaultToEmail,
  error,
  invoiceNumber,
  isSubmitting,
  mode,
  onCancel,
  onSubmit,
  open
}: {
  defaultSubject: string;
  defaultToEmail: string;
  error: string | null;
  invoiceNumber: string;
  isSubmitting: boolean;
  mode: "send" | "resend";
  onCancel: () => void;
  onSubmit: (input: SendInvoiceFormInput) => void;
  open: boolean;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const [to, setTo] = useState(defaultToEmail);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTo(defaultToEmail);
      setCc("");
      setSubject(defaultSubject);
      setValidationError(null);
    }
  }, [open, defaultToEmail, defaultSubject]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formError = validateSendForm(to, cc);

    if (formError) {
      setValidationError(formError);
      return;
    }

    setValidationError(null);
    const toList = parseEmailList(to);
    onSubmit({
      to: toList,
      cc: parseEmailList(cc).filter((email) => !toList.includes(email)),
      subject: subject.trim()
    });
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
          {mode === "send" ? `Send ${invoiceNumber}?` : `Resend ${invoiceNumber}?`}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]" id={descriptionId}>
          {mode === "send"
            ? "This issues the invoice, enables the public link, and emails it to the recipients below."
            : "This sends a new email attempt. Previous delivery attempts stay in the invoice history."}
        </p>

        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-[var(--text-secondary)]">To</span>
            <input
              aria-label="Recipient email addresses"
              autoComplete="email"
              className="mt-1 min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface)] px-3 py-2 text-sm"
              disabled={isSubmitting}
              onChange={(event) => setTo(event.target.value)}
              placeholder="accounts@customer.example"
              value={to}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              CC <span className="font-normal text-[var(--text-muted)]">(optional, comma-separated)</span>
            </span>
            <input
              aria-label="CC email addresses"
              className="mt-1 min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface)] px-3 py-2 text-sm"
              disabled={isSubmitting}
              onChange={(event) => setCc(event.target.value)}
              placeholder="finance@customer.example"
              value={cc}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Subject</span>
            <input
              aria-label="Email subject"
              className="mt-1 min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface)] px-3 py-2 text-sm"
              disabled={isSubmitting}
              maxLength={200}
              onChange={(event) => setSubject(event.target.value)}
              value={subject}
            />
          </label>

          {validationError ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {validationError}
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button disabled={isSubmitting} onClick={onCancel} type="button" variant="outline">
              Cancel
            </Button>
            <Button isLoading={isSubmitting} loadingLabel="Sending..." type="submit" variant="primary">
              {mode === "send" ? "Send invoice" : "Resend email"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
