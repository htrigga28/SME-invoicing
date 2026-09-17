import { describe, expect, it } from "vitest";

import type { InvoiceFormState } from "./types";
import {
  applyDueDatePreset,
  getInvoicePreview,
  toInvoicePayload,
  validateInvoiceForm
} from "./validation";

const validForm: InvoiceFormState = {
  customerId: "customer-1",
  issueDate: "2026-06-28",
  dueDate: "2026-07-12",
  customerReference: "PO-2026-042",
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

  it("rejects overlong customer references", () => {
    expect(
      validateInvoiceForm({ ...validForm, customerReference: "x".repeat(121) })
    ).toMatchObject({
      customerReference: "Customer reference must be 120 characters or fewer."
    });
  });

  it("rejects money above the signed-integer kobo ceiling", () => {
    expect(
      validateInvoiceForm({ ...validForm, discountNaira: "21474836.48" })
    ).toMatchObject({
      discountNaira: "Discount must be from NGN 0.00 through NGN 21,474,836.47."
    });
    expect(
      validateInvoiceForm({
        ...validForm,
        lineItems: [{ description: "Big", quantity: "1", unitPriceNaira: "21474836.48" }]
      })
    ).toMatchObject({
      lineItems: "Unit prices must be from NGN 0.00 through NGN 21,474,836.47."
    });
  });

  it("rejects discount above subtotal", () => {
    expect(validateInvoiceForm({ ...validForm, discountNaira: "500" })).toMatchObject({
      discountNaira: "Discount cannot exceed subtotal."
    });
  });

  it("applies due-date presets from the issue date", () => {
    expect(applyDueDatePreset("2026-06-28", 7)).toBe("2026-07-05");
    expect(applyDueDatePreset("2026-06-28", 30)).toBe("2026-07-28");
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
      customerReference: "PO-2026-042",
      notes: "Payment due in 14 days.",
      discountKobo: 5000,
      taxKobo: 7500,
      lineItems: [{ description: "Design", quantity: 2, unitPriceKobo: 10000 }]
    });
  });

  it("sends null for a blank customer reference", () => {
    expect(toInvoicePayload({ ...validForm, customerReference: "   " }).customerReference).toBeNull();
  });
});
