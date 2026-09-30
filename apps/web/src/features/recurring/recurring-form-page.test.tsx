import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RecurringFormContent } from "./recurring-form-page";

const { createRecurring, getRecurring, updateRecurring, listCustomers, push } = vi.hoisted(() => ({
  createRecurring: vi.fn(),
  getRecurring: vi.fn(),
  updateRecurring: vi.fn(),
  listCustomers: vi.fn(),
  push: vi.fn()
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/features/customers/customers-api", () => ({ listCustomers }));
vi.mock("./recurring-api", () => ({ createRecurring, getRecurring, updateRecurring }));

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

  it("does not silently retain saved recipients after they are cleared", async () => {
    listCustomers.mockResolvedValue({ customers: [{ id: "customer-1", name: "Northstar" }] });
    getRecurring.mockResolvedValue({
      schedule: { customerId: "customer-1", name: "Monthly retainer", startDate: "2026-09-30", nextIssueDate: "2026-10-30", frequency: "monthly", dueTermsDays: 14, endDate: null, autoSend: true, toRecipients: ["accounts@example.com"], ccRecipients: [], emailSubject: null, discountKobo: 0, taxKobo: 0 },
      lineItems: [{ description: "Bookkeeping", quantity: 1, unitPriceKobo: 78450 }]
    });
    render(<RecurringFormContent accessToken="token" role="owner" scheduleId="schedule-1" />);
    await screen.findByDisplayValue("accounts@example.com");
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Enter at least one recipient.")).toBeInTheDocument();
    expect(updateRecurring).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Starts")).toBeDisabled();
  });

  it("removes a line and sends the chosen delivery fields and totals", async () => {
    listCustomers.mockResolvedValue({ customers: [{ id: "customer-1", name: "Northstar" }] });
    createRecurring.mockResolvedValue({ schedule: { id: "schedule-1" } });
    render(<RecurringFormContent accessToken="token" role="owner" />);
    await screen.findByRole("option", { name: "Northstar" });
    fireEvent.change(screen.getByRole("combobox", { name: "Customer" }), { target: { value: "customer-1" } });
    fireEvent.change(screen.getByPlaceholderText("Northstar retainer"), { target: { value: "Monthly retainer" } });
    fireEvent.click(screen.getByRole("button", { name: "Add line" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]!);
    expect(screen.getAllByLabelText("Description")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Bookkeeping" } });
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "1.25" } });
    fireEvent.change(screen.getByLabelText("Unit price (₦)"), { target: { value: "784.50" } });
    fireEvent.change(screen.getByLabelText("Discount (₦)"), { target: { value: "10.00" } });
    fireEvent.change(screen.getByLabelText("Tax (₦)"), { target: { value: "5.00" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "accounts@example.com" } });
    fireEvent.change(screen.getByLabelText("CC"), { target: { value: "finance@example.com" } });
    fireEvent.change(screen.getByLabelText("Email subject"), { target: { value: "Retainer invoice" } });
    fireEvent.click(screen.getByLabelText("Email each invoice automatically"));
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
    await waitFor(() => expect(createRecurring).toHaveBeenCalledWith("token", expect.objectContaining({
      lineItems: [{ description: "Bookkeeping", quantity: 1.25, unitPriceKobo: 78450 }],
      discountKobo: 1000, taxKobo: 500, toRecipients: ["accounts@example.com"], ccRecipients: ["finance@example.com"], emailSubject: "Retainer invoice", autoSend: true
    })));
  });
});
