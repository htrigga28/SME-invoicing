import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Button } from "./button";
import { FilterActions, FilterBar, FilterGrid } from "./filter-bar";

afterEach(() => {
  cleanup();
});

describe("FilterBar", () => {
  it("renders labelled filter controls with shared surface styling", () => {
    render(
      <FilterBar aria-label="Customer filters">
        <FilterGrid>
          <label>
            Search
            <input />
          </label>
          <FilterActions>
            <Button type="submit" variant="outline">
              Apply
            </Button>
          </FilterActions>
        </FilterGrid>
      </FilterBar>
    );

    expect(screen.getByRole("form", { name: "Customer filters" })).toHaveClass(
      "bg-[var(--surface-card)]"
    );
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
  });
});
