import { describe, expect, it } from "vitest";

import type { InvoiceFormState } from "./types";
import { getInvoicePreview, toInvoicePayload, validateInvoiceForm } from "./validation";

const validForm: InvoiceFormState = {
  customerId: "customer-1",
  issueDate: "2026-06-28",
  dueDate: "2026-07-12",
  notes: "Payment due in 14 days.",
  discountNaira: "50",
  taxNaira: "75",
  lineItems: [{ description: "Design", quantity: "2", unitPriceNaira: "100" }]
};

describe("invoice form validation", () => {
  it("validates required customer, dates, and line items", () => {
    expect(
      validateInvoiceForm({
        ...validForm,
        customerId: "",
        issueDate: "",
        dueDate: "",
        lineItems: [{ description: "", quantity: "1", unitPriceNaira: "" }]
      })
    ).toEqual({
      customerId: "Customer is required.",
      dueDate: "Due date is required.",
      issueDate: "Issue date is required.",
      lineItems: "At least one line item is required."
    });
  });

  it("rejects due dates before issue dates", () => {
    expect(validateInvoiceForm({ ...validForm, dueDate: "2026-06-27" })).toMatchObject({
      dueDate: "Due date must be on or after issue date."
    });
  });

  it("shows calculated totals preview", () => {
    expect(getInvoicePreview(validForm)).toMatchObject({
      subtotalKobo: 20000,
      discountKobo: 5000,
      taxKobo: 7500,
      totalKobo: 22500
    });
  });

  it("converts form state to API payload", () => {
    expect(toInvoicePayload(validForm)).toEqual({
      customerId: "customer-1",
      issueDate: "2026-06-28",
      dueDate: "2026-07-12",
      notes: "Payment due in 14 days.",
      discountKobo: 5000,
      taxKobo: 7500,
      lineItems: [{ description: "Design", quantity: 2, unitPriceKobo: 10000 }]
    });
  });
});
