import { describe, expect, it } from "vitest";

import { getOnboardingPath } from "./onboarding";

describe("getOnboardingPath", () => {
  it("maps each persisted onboarding state to its resumable route", () => {
    expect(getOnboardingPath("business_profile")).toBe("/onboarding/business");
    expect(getOnboardingPath("payment_setup")).toBe("/settings/payment-setup?source=onboarding");
    expect(getOnboardingPath(null)).toBe("/dashboard");
  });
});
