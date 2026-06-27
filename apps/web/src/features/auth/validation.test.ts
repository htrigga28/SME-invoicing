import { describe, expect, it } from "vitest";

import {
  isSubmitDisabled,
  validateBusinessProfileForm,
  validateLoginForm,
  validateRegisterForm
} from "./validation";

describe("auth and onboarding validation", () => {
  it("validates required register fields", () => {
    expect(validateRegisterForm({ name: "", email: "bad-email", password: "short" })).toEqual({
      name: "Name is required.",
      email: "A valid email is required.",
      password: "Password must be at least 8 characters."
    });
  });

  it("validates required login fields", () => {
    expect(validateLoginForm({ email: "", password: "" })).toEqual({
      email: "A valid email is required.",
      password: "Password is required."
    });
  });

  it("validates required business onboarding fields", () => {
    expect(
      validateBusinessProfileForm({ businessName: "", email: "", phone: "", address: "" })
    ).toEqual({
      businessName: "Business name is required.",
      email: "A valid email is required.",
      phone: "Phone is required.",
      address: "Address is required."
    });
  });

  it("disables submit while submitting", () => {
    expect(isSubmitDisabled(true)).toBe(true);
    expect(isSubmitDisabled(false)).toBe(false);
  });
});
