import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SignupSection } from "./signup-section";

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (originalAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
    return;
  }

  process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
});

describe("SignupSection", () => {
  it("presents the closing CTA and direct product actions", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.lumina.test";

    render(<SignupSection />);

    expect(
      screen.getByRole("heading", { name: "Turn outstanding invoices into a workflow you can control." })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute(
      "href",
      "https://app.lumina.test/register"
    );
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "https://app.lumina.test/login"
    );
  });
});
