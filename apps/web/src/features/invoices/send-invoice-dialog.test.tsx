import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SendInvoiceDialog, validateSendForm } from "./send-invoice-dialog";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("validateSendForm", () => {
  it("requires at least one recipient", () => {
    expect(validateSendForm("", "")).toContain("at least one recipient");
    expect(validateSendForm("  ", "")).toContain("at least one recipient");
  });

  it("rejects invalid addresses and enforces the recipient cap", () => {
    expect(validateSendForm("not-an-email", "")).toContain("not a valid email");
    expect(
      validateSendForm(
        Array.from({ length: 11 }, (_, index) => `user${index}@example.com`).join(","),
        ""
      )
    ).toContain("No more than 10 recipients");
  });

  it("accepts valid To and CC lists", () => {
    expect(validateSendForm("A@Example.com", "b@example.com, a@example.com")).toBeNull();
  });
});

describe("SendInvoiceDialog", () => {
  function renderDialog(overrides: Partial<React.ComponentProps<typeof SendInvoiceDialog>> = {}) {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    render(
      <SendInvoiceDialog
        defaultSubject="Invoice INV-000007"
        defaultToEmail="accounts@lagosbrightprints.test"
        error={null}
        invoiceNumber="INV-000007"
        isSubmitting={false}
        mode="send"
        onCancel={onCancel}
        onSubmit={onSubmit}
        open
        {...overrides}
      />
    );
    return { onCancel, onSubmit };
  }

  it("prefills the customer email and subject", () => {
    renderDialog();

    expect(screen.getByLabelText("Recipient email addresses")).toHaveValue(
      "accounts@lagosbrightprints.test"
    );
    expect(screen.getByLabelText("Email subject")).toHaveValue("Invoice INV-000007");
  });

  it("validates before submitting and parses comma-separated CC", () => {
    const { onSubmit } = renderDialog();

    fireEvent.change(screen.getByLabelText("Recipient email addresses"), {
      target: { value: "" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send invoice" }));
    expect(screen.getByText(/at least one recipient/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Recipient email addresses"), {
      target: { value: "accounts@lagosbrightprints.test" }
    });
    fireEvent.change(screen.getByLabelText("CC email addresses"), {
      target: { value: "finance@example.com, accounts@lagosbrightprints.test" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send invoice" }));

    expect(onSubmit).toHaveBeenCalledWith({
      to: ["accounts@lagosbrightprints.test"],
      cc: ["finance@example.com"],
      subject: "Invoice INV-000007"
    });
  });

  it("closes on Escape and shows server errors", () => {
    const { onCancel } = renderDialog({ error: "Email delivery is not configured." });

    expect(screen.getByText("Email delivery is not configured.")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("labels the resend mode distinctly", () => {
    renderDialog({ mode: "resend" });

    expect(screen.getByText("Resend INV-000007?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resend email" })).toBeInTheDocument();
  });

  it("moves initial focus into the dialog", () => {
    renderDialog();

    expect(screen.getByLabelText("Recipient email addresses")).toHaveFocus();
  });

  it("renders a native dialog with modal semantics", () => {
    renderDialog();

    const dialog = document.querySelector("dialog");
    expect(dialog).not.toBeNull();
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });
});
