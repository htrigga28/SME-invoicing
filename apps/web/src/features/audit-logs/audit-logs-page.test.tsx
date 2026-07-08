import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuditLogsContent } from "./audit-logs-page";
import { getAuditLog, listAuditLogs } from "./audit-logs-api";

vi.mock("./audit-logs-api", () => ({
  getAuditLog: vi.fn(),
  listAuditLogs: vi.fn()
}));

const auditLog = {
  id: "audit-1",
  action: "invoice_sent",
  actionLabel: "Invoice Sent",
  category: "invoice" as const,
  actor: {
    id: "user-1",
    name: "Demo Owner",
    email: "owner@demo.com"
  },
  actorLabel: "Demo Owner (owner@demo.com)",
  resource: {
    id: "invoice-1",
    type: "invoice",
    label: "INV-000001"
  },
  metadataSummary: "Invoice Number: INV-000001",
  createdAt: "2026-07-08T12:00:00.000Z"
};

beforeEach(() => {
  vi.mocked(listAuditLogs).mockResolvedValue({
    auditLogs: [auditLog],
    pagination: { page: 1, limit: 25, total: 1, totalPages: 1 }
  });
  vi.mocked(getAuditLog).mockResolvedValue({
    auditLog: {
      ...auditLog,
      metadataFields: [
        { key: "invoiceNumber", label: "Invoice Number", value: "INV-000001" },
        { key: "accountNumberLast4", label: "Account Number Last4", value: "6789" }
      ]
    }
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AuditLogsContent", () => {
  it("renders audit log rows and applies filters through the API", async () => {
    render(<AuditLogsContent accessToken="token" />);

    expect(await screen.findByText("Invoice Sent")).toBeInTheDocument();
    expect(screen.getByText("Demo Owner (owner@demo.com)")).toBeInTheDocument();
    expect(screen.getByText("INV-000001")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "invoice" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "invoice" } });
    fireEvent.change(screen.getByLabelText("Action"), { target: { value: "invoice_sent" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(listAuditLogs).toHaveBeenLastCalledWith(
        "token",
        expect.objectContaining({
          action: "invoice_sent",
          category: "invoice",
          search: "invoice"
        })
      )
    );
  });

  it("loads detail as safe metadata rows without raw JSON", async () => {
    render(<AuditLogsContent accessToken="token" />);

    fireEvent.click(await screen.findByRole("button", { name: "View" }));

    expect(await screen.findByText("Event detail")).toBeInTheDocument();
    expect(screen.getAllByText("Invoice Number").length).toBeGreaterThan(0);
    expect(screen.getByText("6789")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "INV-000001" })).toHaveAttribute(
      "href",
      "/invoices/invoice-1"
    );
    expect(
      screen.queryByText(/providerSubaccountCode|rawPayload|publicToken/)
    ).not.toBeInTheDocument();
  });
});
