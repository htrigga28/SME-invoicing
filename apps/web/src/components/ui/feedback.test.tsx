import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmptyState, ErrorState, LoadingSkeleton } from "./feedback";

afterEach(() => {
  cleanup();
});

describe("feedback states", () => {
  it("renders a complete empty state with an optional action", () => {
    render(
      <EmptyState
        action={<button type="button">Create customer</button>}
        description="Add the first customer before creating invoices."
        title="No customers yet."
      />
    );

    expect(screen.getByText("No customers yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create customer" })).toBeInTheDocument();
  });

  it("marks filtered empty states distinctly", () => {
    render(
      <EmptyState
        description="Try changing your filters."
        filtered
        title="No customers match these filters."
      />
    );

    expect(
      screen.getByText("No customers match these filters.").closest("section")
    ).toHaveAttribute("data-filtered-empty");
  });

  it("renders contextual error state with retry", () => {
    const retry = vi.fn();

    render(
      <ErrorState message="Could not load payments." onRetry={retry} title="Payments failed" />
    );

    expect(screen.getByText("Payments failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("renders loading skeleton rows", () => {
    render(<LoadingSkeleton rows={2} />);

    expect(screen.getByRole("status", { name: "Loading" })).toHaveAttribute("aria-busy", "true");
  });
});
