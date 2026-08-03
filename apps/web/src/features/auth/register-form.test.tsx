import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RegisterForm } from "./register-form";

const push = vi.fn();
const register = vi.fn();
const setStoredSession = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push })
}));

vi.mock("./auth-api", () => ({
  register: (...args: unknown[]) => register(...args)
}));

vi.mock("./session", () => ({
  setStoredSession: (...args: unknown[]) => setStoredSession(...args)
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RegisterForm", () => {
  it("focuses the first invalid field and associates accessible errors", () => {
    render(<RegisterForm />);

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    const nameInput = screen.getByLabelText("Name");
    expect(nameInput).toHaveFocus();
    expect(nameInput).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Name is required.")).toHaveAttribute("id", "register-name-error");
  });

  it("stores the session and advances to business onboarding", async () => {
    register.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      onboardingStep: "business_profile"
    });
    render(<RegisterForm />);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada Okafor" } });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" }
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith({
        name: "Ada Okafor",
        email: "ada@example.com",
        password: "password123"
      })
    );
    expect(setStoredSession).toHaveBeenCalledWith({
      accessToken: "access-token",
      refreshToken: "refresh-token"
    });
    expect(push).toHaveBeenCalledWith("/onboarding/business");
  });
});
