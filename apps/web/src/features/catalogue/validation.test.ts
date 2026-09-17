import { describe, expect, it } from "vitest";

import { toCataloguePayload, validateCatalogueForm } from "./validation";

describe("catalogue form validation", () => {
  it("requires a name and a valid price", () => {
    expect(
      validateCatalogueForm({ name: "", description: "", unitPriceNaira: "" })
    ).toMatchObject({
      name: "Name is required.",
      unitPriceNaira: "Default price is required."
    });
  });

  it("rejects overlong values and invalid money", () => {
    expect(
      validateCatalogueForm({
        name: "x".repeat(201),
        description: "y".repeat(2001),
        unitPriceNaira: "12.345"
      })
    ).toMatchObject({
      name: "Name must be 200 characters or fewer.",
      description: "Description must be 2,000 characters or fewer.",
      unitPriceNaira: "Enter a valid NGN amount with at most 2 decimal places."
    });
  });

  it("rejects prices above the signed-integer kobo ceiling", () => {
    expect(
      validateCatalogueForm({
        name: "Bookkeeping",
        description: "",
        unitPriceNaira: "21474836.48"
      })
    ).toMatchObject({
      unitPriceNaira: "Enter an amount from NGN 0.00 through NGN 21,474,836.47."
    });
  });

  it("converts a valid form to an API payload", () => {
    expect(
      toCataloguePayload({
        name: "  Monthly bookkeeping  ",
        description: "  Reconciliation support  ",
        unitPriceNaira: "1500.50"
      })
    ).toEqual({
      name: "Monthly bookkeeping",
      description: "Reconciliation support",
      defaultUnitPriceKobo: 150050
    });
  });
});
