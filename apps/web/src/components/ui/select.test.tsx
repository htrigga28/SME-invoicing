import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Select } from "./select";
import { primaryActionClassName } from "./styles";

afterEach(() => {
  cleanup();
});

describe("Select", () => {
  it("renders a native select with an inset custom chevron", () => {
    render(
      <label>
        Status
        <Select wrapperClassName="mt-1">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
        </Select>
      </label>
    );

    const select = screen.getByRole("combobox", { name: "Status" });
    const chevron = screen.getByTestId("select-chevron");

    expect(select).toHaveClass("appearance-none");
    expect(select).toHaveClass("pr-12");
    expect(select).toHaveClass("bg-[var(--surface-raised)]");
    expect(chevron).toHaveClass("right-4");
    expect(chevron).toHaveClass("pointer-events-none");
  });

  it("keeps primary actions high-contrast while active", () => {
    expect(primaryActionClassName).toContain("bg-[var(--accent)]");
    expect(primaryActionClassName).toContain("text-[var(--accent-foreground)]");
    expect(primaryActionClassName).toContain("hover:bg-[var(--accent-hover)]");
  });
});
