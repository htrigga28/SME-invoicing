import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PrivacyPage, { metadata as privacyMetadata } from "@/app/privacy/page";
import TermsPage, { metadata as termsMetadata } from "@/app/terms/page";

describe("legal routes", () => {
  it("preserves the privacy notice and draft warning", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Privacy notice" })).toBeInTheDocument();
    expect(screen.getByText(/Lumina collects the account, business profile/)).toBeInTheDocument();
    expect(screen.getByText(/requires final owner\/legal review/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "hello@lumina.example" })).toHaveAttribute(
      "href",
      "mailto:hello@lumina.example"
    );
    expect(privacyMetadata).toMatchObject({
      title: "Privacy",
      alternates: { canonical: "/privacy" }
    });
  });

  it("preserves the terms boundaries and metadata", () => {
    render(<TermsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Workspace terms" })).toBeInTheDocument();
    expect(
      screen.getByText(/does not provide wallet balances, withdrawals, payroll/)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Lumina" })).toHaveAttribute("href", "/");
    expect(termsMetadata).toMatchObject({ title: "Terms", alternates: { canonical: "/terms" } });
  });
});
