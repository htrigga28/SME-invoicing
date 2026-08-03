import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OnboardingProgress } from "./onboarding-progress";

describe("OnboardingProgress", () => {
  it("exposes current and completed signup steps without relying on color", () => {
    render(<OnboardingProgress currentStep={2} />);

    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
    const steps = screen.getAllByRole("listitem");
    expect(within(steps[0]!).getByText(/Completed:/)).toBeInTheDocument();
    expect(steps[1]).toHaveAttribute("aria-current", "step");
    expect(within(steps[1]!).getByText(/Current step:/)).toBeInTheDocument();
    expect(within(steps[2]!).getByText(/Upcoming:/)).toBeInTheDocument();
  });
});
