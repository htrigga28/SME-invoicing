import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InvoiceAutomationPanel } from "./invoice-automation-panel";

const { scheduleInvoiceSend, cancelScheduledSend, setInvoiceReminderPreference, onChanged } = vi.hoisted(() => ({
  scheduleInvoiceSend: vi.fn(), cancelScheduledSend: vi.fn(), setInvoiceReminderPreference: vi.fn(), onChanged: vi.fn()
}));
vi.mock("@/features/reminders/reminders-api", () => ({ scheduleInvoiceSend, cancelScheduledSend, setInvoiceReminderPreference }));
vi.mock("@/lib/business-date", () => ({ lagosBusinessDate: () => "2026-09-30" }));

const invoice = { id: "invoice-1", status: "draft", invoiceNumber: "INV-000184", customer: { email: "accounts@example.com" } };
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("invoice automation", () => {
  it("schedules the chosen recipients, CC, subject, and business date", async () => {
    scheduleInvoiceSend.mockResolvedValue({});
    render(<InvoiceAutomationPanel accessToken="token" invoice={invoice} canManage onChanged={onChanged} />);
    expect(screen.getByLabelText("To")).toHaveValue("accounts@example.com");
    expect(screen.getByText(/issue and email this draft invoice/)).toBeInTheDocument();
    expect(screen.getByText(/Lagos time \(WAT\).*Exact send time is not guaranteed/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "accounts@example.com, owner@example.com" } });
    fireEvent.change(screen.getByLabelText("CC"), { target: { value: " finance@example.com " } });
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: " Monthly invoice " } });
    fireEvent.change(screen.getByLabelText("Schedule send date"), { target: { value: "2026-10-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Schedule send" }));
    await waitFor(() => expect(scheduleInvoiceSend).toHaveBeenCalledWith("token", "invoice-1", {
      scheduledSendDate: "2026-10-01", to: ["accounts@example.com", "owner@example.com"], cc: ["finance@example.com"], subject: "Monthly invoice"
    }));
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it("rejects a past date before issuing a request", () => {
    render(<InvoiceAutomationPanel accessToken="token" invoice={invoice} canManage onChanged={onChanged} />);
    fireEvent.change(screen.getByLabelText("Schedule send date"), { target: { value: "2026-09-29" } });
    fireEvent.click(screen.getByRole("button", { name: "Schedule send" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a current or future send date.");
    expect(scheduleInvoiceSend).not.toHaveBeenCalled();
  });

  it("shows a stored schedule read-only with its actual delivery fields", () => {
    render(<InvoiceAutomationPanel accessToken="token" invoice={{ ...invoice, scheduledSendDate: "2026-10-01", scheduledSendTo: ["billing@example.com"], scheduledSendCc: ["finance@example.com"], scheduledSendSubject: "Saved subject" }} canManage={false} onChanged={onChanged} />);
    expect(screen.getByLabelText("To")).toHaveValue("billing@example.com");
    expect(screen.getByLabelText("To")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("CC")).toHaveValue("finance@example.com");
    expect(screen.getByLabelText("Subject")).toHaveValue("Saved subject");
    expect(screen.getByText(/will be issued and emailed on that business date/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps invoice reminder preferences read-only for unauthorized roles", () => {
    render(<InvoiceAutomationPanel accessToken="token" invoice={{ ...invoice, status: "sent", automaticRemindersEnabled: false }} canManage={false} onChanged={onChanged} />);
    expect(screen.getByText("Automatic reminders are off for this invoice.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
