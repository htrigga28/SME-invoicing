import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExportsContent } from "./exports-page";
import { downloadExportCsv } from "./exports-api";
import { toast } from "sonner";

vi.mock("./exports-api", () => ({
  downloadExportCsv: vi.fn()
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

beforeEach(() => {
  vi.mocked(downloadExportCsv).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ExportsContent", () => {
  it("renders dataset panels and hides audit log export from accountants", () => {
    render(<ExportsContent accessToken="token" role="accountant" />);

    expect(screen.getByRole("heading", { name: "Exports" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Customers" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Invoices" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Payments" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Receipts" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Audit Logs" })).not.toBeInTheDocument();
  });

  it("downloads a filtered invoice export with loading and success feedback", async () => {
    render(<ExportsContent accessToken="token" role="owner" />);

    fireEvent.change(screen.getAllByLabelText("Status")[1]!, { target: { value: "paid" } });
    fireEvent.change(screen.getByLabelText("Issue from"), { target: { value: "2026-07-01" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Download CSV" })[1]!);

    expect(screen.getByRole("button", { name: "Downloading..." })).toBeDisabled();

    await waitFor(() =>
      expect(downloadExportCsv).toHaveBeenCalledWith(
        "token",
        "invoices",
        expect.objectContaining({
          issueDateFrom: "2026-07-01",
          status: "paid"
        })
      )
    );
    expect(toast.success).toHaveBeenCalledWith("Invoice export downloaded.");
  });
});
