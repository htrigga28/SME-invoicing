import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DataTable, DataTableContainer, Pagination, TableHeaderCell } from "./data-table";

afterEach(() => {
  cleanup();
});

describe("DataTable", () => {
  it("renders inside the shared overflow container with sticky headers", () => {
    render(
      <DataTableContainer>
        <DataTable>
          <thead>
            <tr>
              <TableHeaderCell>Amount</TableHeaderCell>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>NGN 1,000</td>
            </tr>
          </tbody>
        </DataTable>
      </DataTableContainer>
    );

    expect(screen.getByRole("columnheader", { name: "Amount" })).toHaveClass("sticky");
    expect(screen.getByText("NGN 1,000")).toBeInTheDocument();
  });

  it("renders pagination state and disables unavailable movement", () => {
    const next = vi.fn();
    const previous = vi.fn();

    render(
      <Pagination
        canGoNext
        canGoPrevious={false}
        label="Page 1 of 2"
        onNext={next}
        onPrevious={previous}
      />
    );

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(next).toHaveBeenCalledTimes(1);
  });
});
