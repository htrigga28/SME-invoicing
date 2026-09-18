import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listCatalogueItems } from "@/features/catalogue/catalogue-api";
import { listCustomers } from "@/features/customers/customers-api";

import { InvoiceFormContent } from "./invoice-form-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
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
  sendInvoice: vi.fn(),
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
});
