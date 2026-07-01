import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import {
  createPaymentSetupSubaccount,
  disablePaymentSetupAccount,
  getPaymentSetupAccount,
  listPaymentSetupBanks,
  reactivatePaymentSetupAccount,
  resolvePaymentSetupAccount
} from "./payment-setup-api";
import { PaymentSetupContent } from "./payment-setup-page";
import type { PaymentSetupAccount, PaymentSetupBank } from "./types";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("")
}));

vi.mock("./payment-setup-api", () => ({
  createPaymentSetupSubaccount: vi.fn(),
  disablePaymentSetupAccount: vi.fn(),
  getPaymentSetupAccount: vi.fn(),
  listPaymentSetupBanks: vi.fn(),
  reactivatePaymentSetupAccount: vi.fn(),
  resolvePaymentSetupAccount: vi.fn()
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

const bank = {
  active: true,
  code: "044",
  country: "Nigeria",
  currency: "NGN",
  name: "Access Bank"
} satisfies PaymentSetupBank;

const activeAccount = {
  id: "payment-account-1",
  provider: "paystack",
  bankName: "Access Bank",
  accountName: "Demo Business Ltd",
  accountNumberLast4: "7890",
  status: "active",
  verifiedAt: "2026-06-30T10:00:00.000Z",
  disabledAt: null,
  createdAt: "2026-06-30T10:00:00.000Z",
  updatedAt: "2026-06-30T10:00:00.000Z"
} satisfies PaymentSetupAccount;

const disabledAccount = {
  ...activeAccount,
  status: "disabled",
  disabledAt: "2026-06-30T11:00:00.000Z",
  updatedAt: "2026-06-30T11:00:00.000Z"
} satisfies PaymentSetupAccount;

beforeEach(() => {
  vi.mocked(getPaymentSetupAccount).mockResolvedValue({
    status: "not_configured",
    paymentAccount: null
  });
  vi.mocked(listPaymentSetupBanks).mockResolvedValue({ banks: [bank] });
  vi.mocked(resolvePaymentSetupAccount).mockResolvedValue({
    bankCode: "044",
    bankName: "Access Bank",
    accountNumberLast4: "7890",
    accountName: "Demo Business Ltd"
  });
  vi.mocked(createPaymentSetupSubaccount).mockResolvedValue({ paymentAccount: activeAccount });
  vi.mocked(disablePaymentSetupAccount).mockResolvedValue({
    paymentAccount: disabledAccount
  });
  vi.mocked(reactivatePaymentSetupAccount).mockResolvedValue({
    paymentAccount: activeAccount
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function fillValidSetupForm() {
  const bankSelect = await screen.findByRole("combobox", { name: "Bank" });
  await screen.findByText("Access Bank");
  fireEvent.change(bankSelect, {
    target: { value: "044" }
  });
  fireEvent.change(screen.getByLabelText("Account number"), {
    target: { value: "1234567890" }
  });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Resolve account" })).not.toBeDisabled()
  );
}

describe("PaymentSetupContent", () => {
  it("renders the not configured state and setup form for owners", async () => {
    render(<PaymentSetupContent accessToken="token" role="owner" />);

    expect(await screen.findByRole("heading", { name: "Payment Setup" })).toBeInTheDocument();
    expect(screen.getByText("Configure where invoice payments should settle.")).toBeInTheDocument();
    expect(await screen.findByRole("combobox", { name: "Bank" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolve account" })).toBeDisabled();
  });

  it("renders read-only empty state for viewers", async () => {
    render(<PaymentSetupContent accessToken="token" role="viewer" />);

    expect(
      await screen.findByText(
        "Payment setup has not been completed. Ask an Owner or Admin to configure payouts."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resolve account" })).not.toBeInTheDocument();
    expect(listPaymentSetupBanks).not.toHaveBeenCalled();
  });

  it("loads Paystack banks into the dropdown", async () => {
    render(<PaymentSetupContent accessToken="token" role="admin" />);

    const bankSelect = await screen.findByRole("combobox", { name: "Bank" });
    await screen.findByText("Access Bank");

    expect(bankSelect).toHaveTextContent("Access Bank");
  });

  it("validates Nigerian account number length before resolving", async () => {
    render(<PaymentSetupContent accessToken="token" role="owner" />);

    const bankSelect = await screen.findByRole("combobox", { name: "Bank" });
    await screen.findByText("Access Bank");
    fireEvent.change(bankSelect, {
      target: { value: "044" }
    });
    fireEvent.change(screen.getByLabelText("Account number"), {
      target: { value: "123" }
    });

    expect(screen.getByText("Enter a 10-digit Nigerian account number.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolve account" })).toBeDisabled();
  });

  it("resolves account details and displays a masked confirmation", async () => {
    render(<PaymentSetupContent accessToken="token" role="owner" />);

    await fillValidSetupForm();
    fireEvent.click(screen.getByRole("button", { name: "Resolve account" }));

    expect(await screen.findByText("******7890")).toBeInTheDocument();
    expect(screen.getByText("Demo Business Ltd")).toBeInTheDocument();
    expect(screen.queryByText("1234567890")).not.toBeInTheDocument();
  });

  it("confirms the resolved account and creates a subaccount", async () => {
    render(<PaymentSetupContent accessToken="token" role="admin" />);

    await fillValidSetupForm();
    fireEvent.click(screen.getByRole("button", { name: "Resolve account" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm and activate payouts" }));

    await waitFor(() =>
      expect(createPaymentSetupSubaccount).toHaveBeenCalledWith("token", {
        bankCode: "044",
        accountNumber: "1234567890",
        confirmedAccountName: "Demo Business Ltd"
      })
    );
    expect(
      await screen.findByText("Public invoice payments use this Paystack payout account.")
    ).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("Payment setup activated.", {
      id: "payment-setup-activated"
    });
  });

  it("renders active account details without the provider subaccount code", async () => {
    vi.mocked(getPaymentSetupAccount).mockResolvedValueOnce({
      status: "active",
      paymentAccount: activeAccount
    });

    render(<PaymentSetupContent accessToken="token" role="owner" />);

    expect(await screen.findByText("Payout account")).toBeInTheDocument();
    expect(screen.getByText("Access Bank")).toBeInTheDocument();
    expect(screen.getByText("7890")).toBeInTheDocument();
    expect(screen.queryByText("ACCT_test")).not.toBeInTheDocument();
  });

  it("uses the app dialog for disabling accounts instead of native confirm", async () => {
    vi.mocked(getPaymentSetupAccount).mockResolvedValueOnce({
      status: "active",
      paymentAccount: activeAccount
    });

    render(<PaymentSetupContent accessToken="token" role="owner" />);

    fireEvent.click(await screen.findByRole("button", { name: "Disable account" }));

    const dialog = screen.getByRole("dialog", { name: "Disable payout account?" });
    expect(dialog).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Disable account" }));

    await waitFor(() =>
      expect(disablePaymentSetupAccount).toHaveBeenCalledWith("token", {
        reason: "Disabled from Payment Setup settings."
      })
    );
    expect(toast.success).toHaveBeenCalledWith("Payment setup disabled.", {
      id: "payment-setup-disabled"
    });
  });

  it("shows disabled account reactivation and setup-different actions for owners", async () => {
    vi.mocked(getPaymentSetupAccount).mockResolvedValueOnce({
      status: "disabled",
      paymentAccount: disabledAccount
    });

    render(<PaymentSetupContent accessToken="token" role="owner" />);

    expect(
      await screen.findByText(
        "This payout account is disabled. You can reactivate it or set up a different payout account."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reactivate this account" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set up a different account" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Bank" })).not.toBeInTheDocument();
  });

  it("keeps disabled account reactivation read-only for viewers", async () => {
    vi.mocked(getPaymentSetupAccount).mockResolvedValueOnce({
      status: "disabled",
      paymentAccount: disabledAccount
    });

    render(<PaymentSetupContent accessToken="token" role="viewer" />);

    expect(await screen.findByText("Disabled")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reactivate this account" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Set up a different account" })
    ).not.toBeInTheDocument();
  });

  it("reactivates a disabled account through the app confirmation dialog", async () => {
    vi.mocked(getPaymentSetupAccount).mockResolvedValueOnce({
      status: "disabled",
      paymentAccount: disabledAccount
    });

    render(<PaymentSetupContent accessToken="token" role="admin" />);

    fireEvent.click(await screen.findByRole("button", { name: "Reactivate this account" }));

    const dialog = screen.getByRole("dialog", { name: "Reactivate payout account?" });
    expect(dialog).toHaveTextContent(
      "Future online invoice payments will settle to this Paystack payout account ending ****7890."
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Reactivate account" }));

    await waitFor(() =>
      expect(reactivatePaymentSetupAccount).toHaveBeenCalledWith("token", "payment-account-1", {
        reason: "Reactivated from Payment Setup settings."
      })
    );
    expect(await screen.findByText("Active")).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("Payment setup reactivated.", {
      id: "payment-setup-reactivated"
    });
    expect(screen.queryByText("ACCT_test")).not.toBeInTheDocument();
  });

  it("shows a friendly reactivation error inline and in a toast", async () => {
    vi.mocked(getPaymentSetupAccount).mockResolvedValueOnce({
      status: "disabled",
      paymentAccount: disabledAccount
    });
    vi.mocked(reactivatePaymentSetupAccount).mockRejectedValueOnce(
      new Error("This payout account cannot be reactivated.")
    );

    render(<PaymentSetupContent accessToken="token" role="owner" />);

    fireEvent.click(await screen.findByRole("button", { name: "Reactivate this account" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Reactivate payout account?" })).getByRole(
        "button",
        { name: "Reactivate account" }
      )
    );

    expect(
      await screen.findByText("This payout account cannot be reactivated.")
    ).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("This payout account cannot be reactivated.", {
      id: "payment-setup-reactivate-error"
    });
  });

  it("reveals the setup wizard when setting up a different disabled payout account", async () => {
    vi.mocked(getPaymentSetupAccount).mockResolvedValueOnce({
      status: "disabled",
      paymentAccount: disabledAccount
    });

    render(<PaymentSetupContent accessToken="token" role="owner" />);

    fireEvent.click(await screen.findByRole("button", { name: "Set up a different account" }));

    expect(
      await screen.findByText(
        "Use this if you want payments to settle to a different bank account."
      )
    ).toBeInTheDocument();
    expect(await screen.findByRole("combobox", { name: "Bank" })).toBeInTheDocument();
  });

  it("shows a friendly bank load failure with retry support", async () => {
    vi.mocked(listPaymentSetupBanks).mockRejectedValueOnce(
      new Error("The payment provider is currently unavailable. Please try again later.")
    );

    render(<PaymentSetupContent accessToken="token" role="owner" />);

    expect(await screen.findByText("Could not load banks")).toBeInTheDocument();
    expect(
      screen.getByText("The payment provider is currently unavailable. Please try again later.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith(
      "The payment provider is currently unavailable. Please try again later.",
      {
        id: "payment-setup-banks"
      }
    );
  });

  it("shows a friendly inline resolve error", async () => {
    vi.mocked(resolvePaymentSetupAccount).mockRejectedValueOnce(
      new Error("Could not resolve this account number. Check the bank and account number.")
    );

    render(<PaymentSetupContent accessToken="token" role="owner" />);

    await fillValidSetupForm();
    fireEvent.click(screen.getByRole("button", { name: "Resolve account" }));

    expect(
      await screen.findByText(
        "Could not resolve this account number. Check the bank and account number."
      )
    ).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalledWith(
      "Could not resolve this account number. Check the bank and account number.",
      expect.anything()
    );
  });

  it("shows a toast after resolving the account successfully", async () => {
    render(<PaymentSetupContent accessToken="token" role="owner" />);

    await fillValidSetupForm();
    fireEvent.click(screen.getByRole("button", { name: "Resolve account" }));

    await screen.findByText("Demo Business Ltd");
    expect(toast.success).toHaveBeenCalledWith(
      "Account resolved. Please confirm the account name.",
      {
        id: "payment-setup-resolved"
      }
    );
  });

  it("shows a friendly activation error inline and in a toast", async () => {
    vi.mocked(createPaymentSetupSubaccount).mockRejectedValueOnce(
      new Error("Could not activate payouts with Paystack. Please try again later.")
    );

    render(<PaymentSetupContent accessToken="token" role="admin" />);

    await fillValidSetupForm();
    fireEvent.click(screen.getByRole("button", { name: "Resolve account" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm and activate payouts" }));

    expect(
      await screen.findByText("Could not activate payouts with Paystack. Please try again later.")
    ).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith(
      "Could not activate payouts with Paystack. Please try again later.",
      {
        id: "payment-setup-activation-error"
      }
    );
  });

  it("does not use native browser prompts in payment setup flows", () => {
    const source = readFileSync("src/features/payment-setup/payment-setup-page.tsx", "utf8");

    expect(source).not.toMatch(/window\.(alert|confirm|prompt)|(alert|confirm|prompt)\(/);
  });
});
