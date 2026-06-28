import { describe, expect, it } from "vitest";

import { canManageCustomers } from "./types";
import { normalizeCustomerForm, validateCustomerForm } from "./validation";

describe("customer form validation", () => {
  it("requires customer name and email", () => {
    expect(validateCustomerForm({ name: "", email: "" })).toEqual({
      name: "Customer name is required.",
      email: "Customer email is required."
    });
  });

  it("validates email format", () => {
    expect(validateCustomerForm({ name: "Demo Customer", email: "invalid-email" })).toEqual({
      email: "Enter a valid customer email."
    });
  });

  it("normalizes customer form input", () => {
    expect(
      normalizeCustomerForm({
        name: " Demo Customer ",
        email: " BILLING@EXAMPLE.TEST ",
        phone: " ",
        billingAddress: " Lagos "
      })
    ).toEqual({
      name: "Demo Customer",
      email: "billing@example.test",
      phone: null,
      billingAddress: "Lagos"
    });
  });
});

describe("customer role helpers", () => {
  it("lets owner, admin, and accountant manage customers", () => {
    expect(canManageCustomers("owner")).toBe(true);
    expect(canManageCustomers("admin")).toBe(true);
    expect(canManageCustomers("accountant")).toBe(true);
  });

  it("keeps viewers read-only", () => {
    expect(canManageCustomers("viewer")).toBe(false);
  });
});
