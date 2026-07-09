import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button, IconButton, buttonClassName } from "./button";

afterEach(() => {
  cleanup();
});

describe("Button", () => {
  it("renders a lime primary button with dark readable text", () => {
    render(<Button>Save invoice</Button>);

    const button = screen.getByRole("button", { name: "Save invoice" });

    expect(button).toHaveClass("bg-[var(--accent)]");
    expect(button).toHaveClass("text-[var(--accent-foreground)]");
  });

  it("disables interaction while loading and preserves loading text", () => {
    render(
      <Button isLoading loadingLabel="Saving..." onClick={vi.fn()}>
        Save
      </Button>
    );

    const button = screen.getByRole("button", { name: "Saving..." });

    expect(button).toBeDisabled();
    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });

  it("supports destructive and secondary variants", () => {
    expect(buttonClassName({ variant: "destructive" })).toContain("text-[var(--danger)]");
    expect(buttonClassName({ variant: "secondary" })).toContain("text-[var(--accent)]");
  });

  it("requires an accessible label for icon buttons", () => {
    render(
      <IconButton aria-label="Copy reference">
        <span aria-hidden="true">C</span>
      </IconButton>
    );

    expect(screen.getByRole("button", { name: "Copy reference" })).toBeInTheDocument();
  });
});
