import { describe, expect, it } from "vitest";

import { calculateInvoiceTotals, formatInvoiceNumber, shouldDisplayAsOverdue } from "./invoice";

describe("invoice helpers", () => {
  it("calculates invoice totals from line items and invoice-level adjustments", () => {
    expect(
      calculateInvoiceTotals({
        discountKobo: 5000,
        taxKobo: 7500,
        lineItems: [
          { quantity: 2, unitPriceKobo: 10000 },
          { quantity: 1.5, unitPriceKobo: 20000 }
        ]
      })
    ).toEqual({
      lineTotalsKobo: [20000, 30000],
      subtotalKobo: 50000,
      discountKobo: 5000,
      taxKobo: 7500,
      totalKobo: 52500,
      amountPaidKobo: 0,
      balanceDueKobo: 52500
    });
  });

  it("formats organisation-scoped invoice numbers", () => {
    expect(formatInvoiceNumber(1)).toBe("INV-000001");
    expect(formatInvoiceNumber(123)).toBe("INV-000123");
  });

  it("detects overdue display state without changing terminal statuses", () => {
    expect(
      shouldDisplayAsOverdue({
        balanceDueKobo: 1000,
        dueDate: "2026-01-01",
        status: "sent",
        today: new Date("2026-01-02T12:00:00.000Z")
      })
    ).toBe(true);
    expect(
      shouldDisplayAsOverdue({
        balanceDueKobo: 1000,
        dueDate: "2026-01-01",
        status: "cancelled",
        today: new Date("2026-01-02T12:00:00.000Z")
      })
    ).toBe(false);
  });
});
