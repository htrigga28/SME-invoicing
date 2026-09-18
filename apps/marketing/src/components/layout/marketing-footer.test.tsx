import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarketingFooter } from "./marketing-footer";

afterEach(() => window.history.pushState({}, "", "/"));

describe("MarketingFooter", () => {
  it("keeps product anchors local on the homepage", () => {
    render(<MarketingFooter />);

    expect(screen.getByRole("link", { name: "Invoicing" })).toHaveAttribute(
      "href",
      "#invoicing"
    );
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "href",
      "/privacy"
    );
  });

  it("routes section links through the homepage from legal routes", () => {
    window.history.pushState({}, "", "/terms");
    render(<MarketingFooter />);

    expect(screen.getByRole("link", { name: "Payments & reconciliation" })).toHaveAttribute("href", "/#reconciliation");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute(
      "href",
      "/terms"
    );
  });
});
