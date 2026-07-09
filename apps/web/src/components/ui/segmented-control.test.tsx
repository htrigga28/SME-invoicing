import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SegmentedControl } from "./segmented-control";

afterEach(() => {
  cleanup();
});

describe("SegmentedControl", () => {
  it("renders tab semantics and calls onChange", () => {
    const onChange = vi.fn();

    render(
      <SegmentedControl
        label="Payment views"
        onChange={onChange}
        options={[
          { label: "Reconciliation", value: "reconciliation" },
          { label: "All attempts", value: "all_attempts" }
        ]}
        value="reconciliation"
      />
    );

    expect(screen.getByRole("tab", { name: "Reconciliation" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    fireEvent.click(screen.getByRole("tab", { name: "All attempts" }));

    expect(onChange).toHaveBeenCalledWith("all_attempts");
  });
});
