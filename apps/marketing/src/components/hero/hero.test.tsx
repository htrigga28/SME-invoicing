import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Hero } from "./hero";
import { PaymentTrailVisual } from "./payment-trail-visual";

describe("Hero", () => {
  it("renders the required headline and conversion actions", () => {
    render(<Hero />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Know what got paid—without the spreadsheet chase."
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /join the waitlist/i })).toHaveAttribute(
      "href",
      "#waitlist"
    );
    expect(screen.getByRole("link", { name: /see the payment trail/i })).toHaveAttribute(
      "href",
      "#payment-trail"
    );
    expect(screen.getByText("Illustrative demo data")).toBeInTheDocument();
    expect(screen.getByText("INV-000184")).toBeInTheDocument();
  });

  it("keeps the illustrative product trail visible in server-rendered HTML", () => {
    const markup = renderToStaticMarkup(<PaymentTrailVisual />);

    expect(markup).toContain("INV-000184");
    expect(markup).not.toContain("opacity:0");
    expect(markup).not.toContain("blur(8px)");
  });
});
