import type { OnboardingStep } from "./types";

export function getOnboardingPath(step: OnboardingStep) {
  if (step === "business_profile") {
    return "/onboarding/business";
  }

  if (step === "payment_setup") {
    return "/settings/payment-setup?source=onboarding";
  }

  return "/dashboard";
}
