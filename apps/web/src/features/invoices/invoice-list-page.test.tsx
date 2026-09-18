import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Customer } from "@/features/customers/types";
import { listCustomers } from "@/features/customers/customers-api";

import { InvoiceListContent } from "./invoice-list-page";
import { listInvoices } from "./invoices-api";

vi.mock("./invoices-api", () => ({
  listInvoices: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("@/features/customers/customers-api", () => ({
  listCustomers: vi.fn()
}));

const customer = {
  id: "customer-1",
  name: "Lagos Bright Prints",
  email: "accounts@lagosbrightprints.test",
  phone: "+2348010000001",
  billingAddress: "14 Allen Avenue, Ikeja, Lagos",
  status: "active",
  archivedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
} satisfies Customer;

beforeEach(() => {
  vi.mocked(listInvoices).mockResolvedValue({
    invoices: [],
    pagination: {
      limit: 20,
      page: 1,
      total: 0,
      totalPages: 1
    }
  });
  vi.mocked(listCustomers).mockResolvedValue({
    customers: [customer],
    pagination: {
      limit: 100,
      page: 1,
      total: 1,
      totalPages: 1
    }
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("InvoiceListContent filters", () => {
  it("renders status and customer filters with shared select chevrons", async () => {
    render(<InvoiceListContent accessToken="token" role="owner" />);

    expect(await screen.findByRole("combobox", { name: "Status" })).toHaveClass("pr-12");
    expect(screen.getByRole("combobox", { name: "Customer" })).toHaveClass("pr-12");
    expect(screen.getAllByTestId("select-chevron")).toHaveLength(2);
  });

  it("leaves the summary tabs unselected for statuses only available in the full filter", async () => {
    render(<InvoiceListContent accessToken="token" role="owner" />);

    fireEvent.change(await screen.findByRole("combobox", { name: "Status" }), {
      target: { value: "viewed" }
    });

    await waitFor(() =>
      expect(listInvoices).toHaveBeenLastCalledWith(
        "token",
        expect.objectContaining({ status: "viewed" })
      )
    );
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).toHaveAttribute("aria-selected", "false");
    }
  });
});
