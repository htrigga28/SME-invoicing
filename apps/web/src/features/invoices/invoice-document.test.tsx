import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { InvoiceDocument } from "./invoice-document";

afterEach(() => {
  cleanup();
});

describe("InvoiceDocument", () => {
  it("renders customer-visible values without internal fields", () => {
    const { container } = render(
      <InvoiceDocument
        balanceDueKobo={22500}
        business={{ businessName: "Akin & Co", email: "billing@akinco.test" }}
        customer={{ name: "Lagos Bright Prints", email: "accounts@test.com" }}
        customerMemo="Payment due in 14 days."
        customerReference="PO-2026-042"
        discountKobo={5000}
        dueDate="2026-07-12"
        invoiceNumber="INV-000007"
        issueDate="2026-06-28"
        lineItems={[
          { description: "Design retainer", quantity: 2, unitPriceKobo: 10000, lineTotalKobo: 20000 }
        ]}
        status="draft"
        subtotalKobo={20000}
        taxKobo={7500}
        totalKobo={22500}
      />
    );

    expect(screen.getByText("INV-000007")).toBeInTheDocument();
    expect(screen.getByText("PO-2026-042")).toBeInTheDocument();
    expect(screen.getByText("Payment due in 14 days.")).toBeInTheDocument();
    expect(screen.getByText("Design retainer")).toBeInTheDocument();

    const text = container.textContent ?? "";
    expect(text).not.toContain("organisation");
    expect(text).not.toContain("public-token");
    expect(text).not.toContain("paystack");
  });

  it("handles long descriptions and many lines without clipping", () => {
    const longDescription = "x".repeat(500);

    render(
      <InvoiceDocument
        customer={{ name: "Customer", email: "customer@test.com" }}
        customerMemo={null}
        customerReference={null}
        discountKobo={0}
        dueDate="2026-07-12"
        invoiceNumber="INV-000008"
        issueDate="2026-06-28"
        lineItems={Array.from({ length: 12 }, (_, index) => ({
          description: index === 0 ? longDescription : `Line ${index + 1}`,
          quantity: 1,
          unitPriceKobo: 10000,
          lineTotalKobo: 10000
        }))}
        status="draft"
        subtotalKobo={120000}
        taxKobo={0}
        totalKobo={120000}
      />
    );

    expect(screen.getByText(longDescription)).toBeInTheDocument();
    expect(screen.getByText("Line 12")).toBeInTheDocument();
  });
});
