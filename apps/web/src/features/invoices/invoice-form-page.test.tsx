import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listCatalogueItems } from "@/features/catalogue/catalogue-api";
import { listCustomers } from "@/features/customers/customers-api";

import { InvoiceFormContent } from "./invoice-form-page";
import { createInvoice } from "./invoices-api";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push })
}));

vi.mock("@/features/catalogue/catalogue-api", () => ({
  createCatalogueItem: vi.fn(),
  listCatalogueItems: vi.fn()
}));

vi.mock("@/features/customers/customers-api", () => ({
  listCustomers: vi.fn()
}));

vi.mock("./invoices-api", () => ({
  createInvoice: vi.fn(),
  getInvoice: vi.fn(),
  updateInvoice: vi.fn()
}));

describe("InvoiceFormContent", () => {
  beforeEach(() => {
    vi.mocked(listCustomers).mockResolvedValue({
      customers: [
        {
          id: "customer-1",
          name: "Lagos Bright Prints",
          email: "accounts@lagosbrightprints.test",
          phone: null,
          billingAddress: null,
          status: "active",
          archivedAt: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z"
        }
      ],
      pagination: { limit: 100, page: 1, total: 1, totalPages: 1 }
    });
    vi.mocked(listCatalogueItems).mockResolvedValue({
      catalogueItems: [
        {
          id: "catalogue-1",
          name: "Monthly bookkeeping",
          description: null,
          defaultUnitPriceKobo: 150000,
          status: "active",
          archivedAt: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z"
        }
      ]
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("labels the editor selects and renders the customer-facing preview", async () => {
    render(
      <InvoiceFormContent
        accessToken="token"
        business={{ businessName: "Akin & Co" }}
        mode="create"
      />
    );

    expect(await screen.findByLabelText("Customer")).toBeInTheDocument();
    expect(screen.getByLabelText("Add from catalogue")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview invoice" })).toBeInTheDocument();
    expect(screen.getByLabelText("Invoice Draft")).toBeInTheDocument();
  });

  it("saves the draft and opens the send dialog instead of sending directly", async () => {
    vi.mocked(createInvoice).mockResolvedValue({ invoice: { id: "invoice-9" } } as never);
    render(
      <InvoiceFormContent
        accessToken="token"
        business={{ businessName: "Akin & Co" }}
        mode="create"
      />
    );

    fireEvent.change(await screen.findByLabelText("Customer"), {
      target: { value: "customer-1" }
    });
    fireEvent.change(screen.getByLabelText("Line item 1 description"), {
      target: { value: "Design retainer" }
    });
    fireEvent.change(screen.getByLabelText("Line item 1 unit price in NGN"), {
      target: { value: "1000" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and send" }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/invoices/invoice-9?send=1")
    );
  });
});
