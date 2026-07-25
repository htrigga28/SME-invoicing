import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarketingHeader } from "./marketing-header";

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  window.history.pushState({}, "", "/");
  if (originalAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
    return;
  }

  process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
});

describe("MarketingHeader", () => {
  it("renders the focused Product menu, sign-in URL, and waitlist CTA", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.lumina.test";

    render(<MarketingHeader />);

    expect(screen.getByRole("link", { name: "Lumina home" })).toHaveAttribute("href", "/");
    const productButton = screen.getByRole("button", { name: "Product" });
    expect(productButton).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(productButton);
    expect(productButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: /Payment trail/i })).toHaveAttribute("href", "#payment-trail");
    expect(screen.getByText("Follow money from invoice to receipt")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Sign In" })[0]).toHaveAttribute(
      "href",
      "https://app.lumina.test/login"
    );
    expect(screen.getAllByRole("link", { name: /join waitlist/i })[0]).toHaveAttribute(
      "href",
      "#waitlist"
    );
  });

  it("shifts the Product preview and closes it with Escape", () => {
    render(<MarketingHeader />);

    fireEvent.click(screen.getByRole("button", { name: "Product" }));
    fireEvent.focus(screen.getByRole("link", { name: /Operations/i }));

    expect(screen.getByText("Run the day from financial truth")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Product" })).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the mobile navigation drawer", () => {
    render(<MarketingHeader />);

    fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));

    expect(screen.getByRole("button", { name: "Close navigation menu" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Mobile primary" })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Product" }).at(-1)!);
    expect(screen.getByRole("link", { name: /Outcomes/i })).toHaveAttribute("href", "#outcomes");
  });

  it("uses homepage routes for section links when rendered on a legal page", () => {
    window.history.pushState({}, "", "/privacy");
    render(<MarketingHeader />);

    fireEvent.click(screen.getByRole("button", { name: "Product" }));
    expect(screen.getByRole("link", { name: /Payment trail/i })).toHaveAttribute("href", "/#payment-trail");
    expect(screen.getAllByRole("link", { name: /join waitlist/i })[0]).toHaveAttribute(
      "href",
      "/?waitlist_source=nav#waitlist"
    );
  });
});
