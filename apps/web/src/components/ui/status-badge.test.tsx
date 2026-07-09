import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StatusBadge, getStatusTone } from "./status-badge";

afterEach(() => {
  cleanup();
});

describe("StatusBadge", () => {
  it("maps paid-like states to success", () => {
    expect(getStatusTone("paid")).toBe("success");
    expect(getStatusTone("matched")).toBe("success");
  });

  it("maps pending/review states to warning", () => {
    expect(getStatusTone("pending")).toBe("warning");
    expect(getStatusTone("review_required")).toBe("warning");
  });

  it("maps failed/overdue states to danger", () => {
    expect(getStatusTone("failed")).toBe("danger");
    expect(getStatusTone("overdue")).toBe("danger");
  });

  it("renders text so status is not color-only", () => {
    render(<StatusBadge status="paid">Paid</StatusBadge>);

    const badge = screen.getByText("Paid");

    expect(badge).toHaveClass("text-[var(--success)]");
  });
});
