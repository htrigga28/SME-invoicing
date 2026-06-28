import type { CustomerFormInput } from "./types";

export type CustomerFormErrors = Partial<Record<keyof CustomerFormInput, string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCustomerForm(input: CustomerFormInput): CustomerFormErrors {
  const errors: CustomerFormErrors = {};
  const name = input.name.trim();
  const email = input.email.trim();

  if (!name) {
    errors.name = "Customer name is required.";
  }

  if (!email) {
    errors.email = "Customer email is required.";
  } else if (!emailPattern.test(email)) {
    errors.email = "Enter a valid customer email.";
  }

  return errors;
}

export function normalizeCustomerForm(input: CustomerFormInput): CustomerFormInput {
  return {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() || null,
    billingAddress: input.billingAddress?.trim() || null
  };
}
