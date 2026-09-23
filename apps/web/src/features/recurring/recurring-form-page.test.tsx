import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RecurringFormContent } from "./recurring-form-page";

const { createRecurring, listCustomers, push } = vi.hoisted(() => ({
  createRecurring: vi.fn(),
  listCustomers: vi.fn(),
  push: vi.fn()
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/features/customers/customers-api", () => ({ listCustomers }));
vi.mock("./recurring-api", () => ({ createRecurring, getRecurring: vi.fn(), updateRecurring: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("recurring invoice form", () => {
  it("uses a current business date and converts naira prices to kobo", async () => {
    listCustomers.mockResolvedValue({ customers: [{ id: "customer-1", name: "Northstar" }] });
    createRecurring.mockResolvedValue({ schedule: { id: "schedule-1" } });
    render(<RecurringFormContent accessToken="token" role="owner" />);
    await screen.findByRole("option", { name: "Northstar" });
    const start = screen.getByLabelText("Starts") as HTMLInputElement;
    expect(start.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(start.value >= start.min).toBe(true);

    fireEvent.change(screen.getByRole("combobox", { name: "Customer" }), { target: { value: "customer-1" } });
    fireEvent.change(screen.getByPlaceholderText("Northstar retainer"), { target: { value: "Monthly retainer" } });
    fireEvent.change(screen.getByPlaceholderText("Description"), { target: { value: "Bookkeeping" } });
    fireEvent.change(screen.getByLabelText("Unit price (₦)"), { target: { value: "784.50" } });
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
    await waitFor(() => expect(createRecurring).toHaveBeenCalledWith("token", expect.objectContaining({
      lineItems: [{ description: "Bookkeeping", quantity: 1, unitPriceKobo: 78450 }]
    })));
    expect(push).toHaveBeenCalledWith("/recurring-invoices/schedule-1");
  });
});
