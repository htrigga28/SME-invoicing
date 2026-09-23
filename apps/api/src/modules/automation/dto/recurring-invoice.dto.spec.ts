import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

import { CreateRecurringInvoiceDto } from "./recurring-invoice.dto";

const valid = {
  name: "Monthly support",
  customerId: "3b8ac751-49fb-475e-9344-7a8428d5ebc1",
  startDate: "2028-02-29",
  frequency: "monthly",
  lineItems: [{ description: "Support", quantity: 1.25, unitPriceKobo: 10_000 }]
};

describe("recurring invoice DTO", () => {
  it("accepts a real business date and decimal quantity", () => {
    expect(validateSync(plainToInstance(CreateRecurringInvoiceDto, valid))).toEqual([]);
  });

  it.each(["2026-02-31", "2026-13-01", "2026-09-30T00:00:00Z"])(
    "rejects invalid date %s",
    (startDate) => {
      const errors = validateSync(plainToInstance(CreateRecurringInvoiceDto, { ...valid, startDate }));
      expect(errors.some((error) => error.property === "startDate")).toBe(true);
    }
  );

  it.each([0, -1, 1.234, "Infinity"])("rejects invalid quantity %s", (quantity) => {
    const errors = validateSync(plainToInstance(CreateRecurringInvoiceDto, {
      ...valid,
      lineItems: [{ ...valid.lineItems[0], quantity }]
    }));
    expect(errors.some((error) => error.property === "lineItems")).toBe(true);
  });
});
