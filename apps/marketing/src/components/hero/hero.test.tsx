import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Hero } from "./hero";
import { InvoiceHeroScene } from "./invoice-hero-scene";

describe("Hero", () => {
  it("renders the required headline and conversion actions", () => {
    render(<Hero />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Turn every invoice into predictable cash."
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create account/i })).toHaveAttribute(
      "href",
      "http://localhost:3000/register"
    );
    expect(screen.getByRole("link", { name: /see how it works/i })).toHaveAttribute(
      "href",
      "#how-it-works"
    );
    expect(screen.getByText("Illustrative demo data")).toBeInTheDocument();
    expect(screen.getByText("INV-000184")).toBeInTheDocument();
  });

  it("keeps the illustrative invoice visible in server-rendered HTML", () => {
    const markup = renderToStaticMarkup(<InvoiceHeroScene />);

    expect(markup).toContain("INV-000184");
    expect(markup).not.toContain("opacity:0");
    expect(markup).not.toContain("blur(8px)");
  });
});
