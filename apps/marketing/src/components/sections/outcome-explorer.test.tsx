import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OutcomeExplorer } from "./outcome-explorer";

describe("OutcomeExplorer", () => {
  it("switches the product visual through accessible tabs", () => {
    render(<OutcomeExplorer />);

    const matched = screen.getByRole("tab", { name: "Matched" });
    const review = screen.getByRole("tab", { name: "Needs review" });
    expect(matched).toHaveAttribute("aria-selected", "true");

    fireEvent.click(review);

    expect(review).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "The noise clears. The exception stays." })).toBeInTheDocument();
  });

  it("supports arrow-key navigation between outcomes", () => {
    render(<OutcomeExplorer />);

    fireEvent.keyDown(screen.getByRole("tab", { name: "Matched" }), { key: "ArrowRight" });
    const review = screen.getByRole("tab", { name: "Needs review" });
    expect(review).toHaveAttribute("aria-selected", "true");
    expect(review).toHaveFocus();

    fireEvent.keyDown(review, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Refund confirmed" })).toHaveFocus();
  });
});
