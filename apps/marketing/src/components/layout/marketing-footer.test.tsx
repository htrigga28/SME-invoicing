import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarketingFooter } from "./marketing-footer";

afterEach(() => window.history.pushState({}, "", "/"));

describe("MarketingFooter", () => {
  it("keeps product anchors local on the homepage", () => {
    render(<MarketingFooter />);

    expect(screen.getByRole("link", { name: "Payment trail" })).toHaveAttribute("href", "#payment-trail");
    expect(screen.getByRole("link", { name: "Early access" })).toHaveAttribute("href", "#waitlist");
  });

  it("routes section links through the homepage from legal routes", () => {
    window.history.pushState({}, "", "/terms");
    render(<MarketingFooter />);

    expect(screen.getByRole("link", { name: "Outcomes" })).toHaveAttribute("href", "/#outcomes");
    expect(screen.getByRole("link", { name: "Early access" })).toHaveAttribute("href", "/#waitlist");
  });
});
