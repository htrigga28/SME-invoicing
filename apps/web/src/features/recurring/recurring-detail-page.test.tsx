import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RecurringDetailContent } from "./recurring-detail-page";

const { getRecurring, pauseRecurring, resumeRecurring, cancelRecurring, push } = vi.hoisted(() => ({
  getRecurring: vi.fn(), pauseRecurring: vi.fn(), resumeRecurring: vi.fn(), cancelRecurring: vi.fn(), push: vi.fn()
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("./recurring-api", () => ({ getRecurring, pauseRecurring, resumeRecurring, cancelRecurring }));

const schedule = {
  id: "schedule-1", name: "Monthly retainer", status: "active", frequency: "monthly",
  customerId: "customer-1", customerName: "Northstar", amountKobo: 7840000,
  nextIssueDate: "2026-10-30", startDate: "2026-09-30", endDate: null,
  dueTermsDays: 14, autoSend: true, toRecipients: ["accounts@example.com"], ccRecipients: [],
  emailSubject: "Monthly invoice", lastGeneratedAt: "2026-09-30T06:00:00Z"
};

afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("recurring schedule detail", () => {
  it("shows invoice and delivery details with a direct invoice link", async () => {
    getRecurring.mockResolvedValue({ schedule, automation: [], occurrences: [{
      id: "occurrence-1", status: "generated", scheduledFor: "2026-09-30",
      invoice: { id: "invoice-1", invoiceNumber: "INV-000184", status: "sent", issueDate: "2026-09-30", dueDate: "2026-10-14", totalKobo: 7840000, deliveryStatus: "sent" }
    }] });
    render(<RecurringDetailContent accessToken="token" role="viewer" id="schedule-1" />);
    expect(await screen.findByText("INV-000184")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View invoice →" })).toHaveAttribute("href", "/invoices/invoice-1");
    expect(screen.getByText(/Issue date 30 Sept 2026/)).toHaveTextContent("Due 14 Oct 2026");
    expect(screen.getByText("Delivery: sent")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "End schedule" })).not.toBeInTheDocument();
  });

  it("shows needs-attention and pending retry states from automation jobs", async () => {
    getRecurring.mockResolvedValue({ schedule, occurrences: [], automation: [
      { id: "job-1", status: "needs_attention", scheduledFor: "2026-09-30", lastError: "Invoice generation failed" },
      { id: "job-2", status: "pending", scheduledFor: "2026-10-30", lastError: "Temporary failure" }
    ] });
    render(<RecurringDetailContent accessToken="token" role="owner" id="schedule-1" />);
    expect(await screen.findByText("needs attention")).toBeInTheDocument();
    expect(screen.getByText("Invoice generation failed")).toBeInTheDocument();
    expect(screen.getByText(/Retry pending/)).toBeInTheDocument();
  });

  it("retains the schedule when an action fails so the user can retry", async () => {
    getRecurring.mockResolvedValue({ schedule, occurrences: [], automation: [] });
    pauseRecurring.mockRejectedValue(new Error("Network unavailable"));
    render(<RecurringDetailContent accessToken="token" role="owner" id="schedule-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Pause" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Pause" }));
    expect(await screen.findByText("Action failed.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Monthly retainer" })).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Pause" })).toBeEnabled());
  });

  it("waits for confirmation before ending the schedule", async () => {
    getRecurring.mockResolvedValue({ schedule, occurrences: [], automation: [] });
    cancelRecurring.mockResolvedValue({});
    render(<RecurringDetailContent accessToken="token" role="owner" id="schedule-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "End schedule" }));
    expect(cancelRecurring).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "End schedule" }));
    await waitFor(() => expect(cancelRecurring).toHaveBeenCalledWith("token", "schedule-1"));
  });
});
