import { BadRequestException } from "@nestjs/common";

import { InvoicesService } from "./invoices.service";

type ServiceInternals = {
  assertDateOrder: (issueDate: string, dueDate: string) => void;
  calculateAndValidateTotals: (
    lineItems: { description: string; quantity: number; unitPriceKobo: number }[],
    input: { discountKobo: number; taxKobo: number }
  ) => {
    amountPaidKobo: number;
    balanceDueKobo: number;
    discountKobo: number;
    lineTotalsKobo: number[];
    subtotalKobo: number;
    taxKobo: number;
    totalKobo: number;
  };
  normalizeLineItems: (
    lineItems: { description: string; quantity: number; unitPriceKobo: number }[]
  ) => { description: string; quantity: number; unitPriceKobo: number }[];
};

function setup() {
  const service = new InvoicesService({} as never, {} as never, {} as never);
  return service as unknown as ServiceInternals;
}

describe("InvoicesService validation helpers", () => {
  it("calculates line totals and invoice totals server-side", () => {
    const service = setup();

    expect(
      service.calculateAndValidateTotals(
        [
          { description: "Design", quantity: 2, unitPriceKobo: 10000 },
          { description: "Support", quantity: 1.5, unitPriceKobo: 20000 }
        ],
        { discountKobo: 5000, taxKobo: 7500 }
      )
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

  it("rejects discounts greater than subtotal", () => {
    const service = setup();

    expect(() =>
      service.calculateAndValidateTotals(
        [{ description: "Design", quantity: 1, unitPriceKobo: 10000 }],
        { discountKobo: 10001, taxKobo: 0 }
      )
    ).toThrow(BadRequestException);
  });

  it("rejects due dates before issue dates", () => {
    const service = setup();

    expect(() => service.assertDateOrder("2026-06-28", "2026-06-27")).toThrow(BadRequestException);
  });

  it("normalizes and validates line item descriptions", () => {
    const service = setup();

    expect(
      service.normalizeLineItems([{ description: "  Design  ", quantity: 1, unitPriceKobo: 1000 }])
    ).toEqual([{ description: "Design", quantity: 1, unitPriceKobo: 1000 }]);
    expect(() =>
      service.normalizeLineItems([{ description: " ", quantity: 1, unitPriceKobo: 1000 }])
    ).toThrow(BadRequestException);
  });
});
