import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./confirm-dialog";

afterEach(() => {
  cleanup();
});

describe("ConfirmDialog", () => {
  it("renders accessible dialog copy and actions", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        confirmLabel="Archive customer"
        description="Archived customers cannot be edited."
        onCancel={onCancel}
        onConfirm={onConfirm}
        open
        title="Archive this customer?"
      />
    );

    expect(screen.getByRole("dialog", { name: "Archive this customer?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Archive customer" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables actions while loading", () => {
    render(
      <ConfirmDialog
        confirmLabel="Disable account"
        description="Online payments will stop."
        isLoading
        loadingLabel="Disabling..."
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open
        title="Disable payout account?"
      />
    );

    expect(screen.getByRole("button", { name: "Disabling..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
