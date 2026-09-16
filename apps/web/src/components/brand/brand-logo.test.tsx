import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrandLogo } from "./brand-logo";

describe("BrandLogo", () => {
  it("uses the Lumina wordmark and hides the decorative mark from assistive technology", () => {
    render(<BrandLogo />);

    expect(screen.getByText("Lumina")).toBeInTheDocument();
    expect(screen.getByText("Lumina").previousElementSibling).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  });
});
