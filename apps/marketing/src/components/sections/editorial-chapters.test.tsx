import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AudienceBridge } from "./audience-bridge";
import { CustomerPaymentChapter } from "./customer-payment-chapter";
import { ClosingCta } from "./closing-cta";
import { InvoicingChapter } from "./invoicing-chapter";
import { getStorySegmentProgress, InvoiceToCashStory } from "./invoice-to-cash-story";
import { ReceivablesVisibility } from "./receivables-visibility";
import { TrustControls } from "./trust-controls";

describe("Editorial receivables chapters", () => {
  it("renders the audience bridge without fake social proof", () => {
    render(<AudienceBridge />);
    expect(screen.getByText("For the people who turn finished work into cash.")).toBeInTheDocument();
    expect(screen.getByText("Growing businesses")).toBeInTheDocument();
    expect(screen.queryByText(/customers|logos/i)).not.toBeInTheDocument();
  });

  it("renders six consistent signature beats with one canonical invoice", () => {
    const { container } = render(<InvoiceToCashStory />);
    expect(screen.getByRole("heading", { name: "One invoice, from creation to financial truth." })).toBeInTheDocument();
    ["CREATE", "SHARE", "PAY", "VERIFY", "MATCH", "KNOW"].forEach((label) => {
      expect(screen.getAllByText(label, { exact: false }).length).toBeGreaterThan(0);
    });
    expect(container.querySelectorAll(".story-shell [data-story-step]")).toHaveLength(6);
    expect(container.querySelectorAll(".story-shell [data-story-state]")).toHaveLength(6);
    expect(container.querySelectorAll(".story-progress [data-story-progress-segment]")).toHaveLength(6);
    expect(container.querySelectorAll(".story-mobile-step")).toHaveLength(6);
    expect(screen.getAllByText(/INV-000184/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/T8129-4F3A-90LX/).length).toBeGreaterThanOrEqual(1);
  });

  it("fills each story progress segment in sequence", () => {
    expect(Array.from({ length: 6 }, (_, index) => getStorySegmentProgress(0.25, index, 6))).toEqual([
      1, 0.5, 0, 0, 0, 0
    ]);
  });

  it("presents the T020 invoicing chapter with editor and preview", () => {
    render(<InvoicingChapter />);
    expect(screen.getByRole("heading", { name: /Compose the invoice once/ })).toBeInTheDocument();
    expect(screen.getByText("Editor")).toBeInTheDocument();
    expect(screen.getByText("Customer preview")).toBeInTheDocument();
    expect(screen.queryByText(/recurring|reminder/i)).not.toBeInTheDocument();
  });

  it("shows one receivables surface with real operational metrics", () => {
    render(<ReceivablesVisibility />);
    expect(screen.getByRole("heading", { name: /See what needs attention/ })).toBeInTheDocument();
    expect(screen.getByText("Outstanding")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("Net collected")).toBeInTheDocument();
    expect(screen.queryByText(/forecast|DSO/i)).not.toBeInTheDocument();
  });

  it("keeps the customer payment chapter portal-free with one CTA", () => {
    render(<CustomerPaymentChapter />);
    expect(screen.getByRole("heading", { name: /one clear invoice and one clear next step/ })).toBeInTheDocument();
    expect(screen.getByText(/Pay .* online/)).toBeInTheDocument();
    expect(screen.queryByText(/portal|saved card/i)).not.toBeInTheDocument();
  });

  it("states trust boundaries factually without certification claims", () => {
    render(<TrustControls />);
    expect(screen.getByRole("heading", { name: /without becoming your bank/ })).toBeInTheDocument();
    expect(screen.getByText("Provider-confirmed payment status")).toBeInTheDocument();
    expect(screen.queryByText(/PCI|SOC|ISO/i)).not.toBeInTheDocument();
  });

  it("closes with one deep-green action", () => {
    render(<ClosingCta />);
    expect(screen.getByRole("heading", { name: /workflow you can control/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create account" })).toBeInTheDocument();
  });

  it("uses Acctual-style off-canvas vectors instead of uniform fade-up", () => {
    const { container } = render(<InvoiceToCashStory />);
    const vectors = new Set(
      Array.from(container.querySelectorAll("[data-enter]")).map((n) => n.getAttribute("data-enter"))
    );
    // Signature must use varied horizontal/diagonal vectors, not one direction.
    expect(vectors.size).toBeGreaterThanOrEqual(4);
    expect(vectors.has("left")).toBe(true);
    expect(vectors.has("right")).toBe(true);
  });

  it("marks chapter compositions with directional entrances", () => {
    const { container } = render(
      <>
        <InvoicingChapter />
        <CustomerPaymentChapter />
      </>
    );
    const vectors = Array.from(container.querySelectorAll("[data-enter]")).map((n) =>
      n.getAttribute("data-enter")
    );
    expect(vectors).toContain("left");
    expect(vectors).toContain("right");
  });
});
