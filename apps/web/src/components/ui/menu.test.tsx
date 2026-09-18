import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DropdownMenu } from "./menu";

afterEach(cleanup);

describe("DropdownMenu", () => {
  it("supports keyboard navigation and restores focus when closed", () => {
    const onSelect = vi.fn();

    render(
      <DropdownMenu
        label="Invoice actions"
        trigger="Actions"
        items={[
          { label: "Edit", onSelect },
          { label: "Unavailable", disabled: true },
          { label: "Duplicate", onSelect }
        ]}
      />
    );

    const trigger = screen.getByRole("button", { name: "Invoice actions" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    const edit = screen.getByRole("menuitem", { name: "Edit" });
    const duplicate = screen.getByRole("menuitem", { name: "Duplicate" });
    expect(edit).toHaveFocus();

    fireEvent.keyDown(edit, { key: "End" });
    expect(duplicate).toHaveFocus();

    fireEvent.keyDown(duplicate, { key: "ArrowDown" });
    expect(edit).toHaveFocus();

    fireEvent.keyDown(edit, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
