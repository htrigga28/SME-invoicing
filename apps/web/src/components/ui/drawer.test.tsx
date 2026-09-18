import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Drawer } from "./drawer";

const showModal = vi.fn(function (this: HTMLDialogElement) {
  this.open = true;
});
const close = vi.fn(function (this: HTMLDialogElement) {
  this.open = false;
});

beforeEach(() => {
  showModal.mockReset();
  close.mockReset();
  HTMLDialogElement.prototype.showModal = showModal;
  HTMLDialogElement.prototype.close = close;
});

afterEach(() => {
  document.body.style.overflow = "";
  cleanup();
});

describe("Drawer", () => {
  it("uses a modal dialog, locks scroll, and restores focus when closed", () => {
    const returnFocus = document.createElement("button");
    document.body.append(returnFocus);
    returnFocus.focus();
    const focus = vi.spyOn(returnFocus, "focus");

    const { rerender } = render(
      <Drawer onClose={vi.fn()} open title="Invoice preview">
        Preview content
      </Drawer>
    );

    expect(showModal).toHaveBeenCalledOnce();
    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <Drawer onClose={vi.fn()} open={false} title="Invoice preview">
        Preview content
      </Drawer>
    );

    expect(close).toHaveBeenCalledOnce();
    expect(document.body.style.overflow).toBe("");
    expect(focus).toHaveBeenCalled();
    returnFocus.remove();
  });

  it("requests close for Escape cancellation and backdrop clicks", () => {
    const onClose = vi.fn();
    render(
      <Drawer onClose={onClose} open title="Invoice preview">
        Preview content
      </Drawer>
    );

    const dialog = screen.getByRole("dialog", { name: "Invoice preview" });
    fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));
    fireEvent.pointerDown(dialog);

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
