import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { submitWaitlistEntry } from "@/lib/waitlist-api";
import { WaitlistSection } from "./waitlist-section";

vi.mock("@/lib/waitlist-api", () => ({
  submitWaitlistEntry: vi.fn()
}));

const submitMock = vi.mocked(submitWaitlistEntry);

afterEach(() => {
  submitMock.mockReset();
  window.history.pushState({}, "", "/");
});

describe("WaitlistSection", () => {
  it("keeps optional business fields behind a native disclosure", () => {
    const { container } = render(<WaitlistSection />);

    const details = container.querySelector("details");
    expect(details).not.toHaveAttribute("open");
    expect(screen.getByText("Add business details (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Work email")).toBeVisible();
  });

  it("validates work email before submitting", () => {
    render(<WaitlistSection />);

    fireEvent.click(screen.getByRole("button", { name: "Join the waitlist" }));

    expect(screen.getByText("Work email is required.")).toBeInTheDocument();
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("submits waitlist details with CTA source and UTM attribution", async () => {
    submitMock.mockResolvedValue({
      success: true,
      message: "You're on the list. We'll let you know when early access opens."
    });
    window.history.pushState(
      {},
      "",
      "/?utm_source=google&utm_medium=cpc&utm_campaign=early&utm_content=hero&utm_term=invoice"
    );

    render(<WaitlistSection />);
    window.dispatchEvent(new CustomEvent("lumina:waitlist-source", { detail: "hero" }));

    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "founder@lagosagency.test" }
    });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada Okonkwo" } });
    fireEvent.change(screen.getByLabelText("Business name"), {
      target: { value: "Lagos Agency" }
    });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "Founder / Owner" } });
    fireEvent.click(screen.getByRole("button", { name: "Join the waitlist" }));

    await waitFor(() => {
      expect(submitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          companyName: "Lagos Agency",
          email: "founder@lagosagency.test",
          fullName: "Ada Okonkwo",
          role: "Founder / Owner",
          source: "hero",
          utm: {
            utm_campaign: "early",
            utm_content: "hero",
            utm_medium: "cpc",
            utm_source: "google",
            utm_term: "invoice"
          }
        })
      );
    });
    expect(await screen.findByText("You're on the list.")).toBeInTheDocument();
  });

  it("keeps the honeypot hidden from real users", () => {
    const { container } = render(<WaitlistSection />);

    expect(container.querySelector("#waitlist-website")).not.toBeVisible();
  });

  it("preserves a route-aware waitlist source from the URL", async () => {
    submitMock.mockResolvedValue({ success: true, message: "Joined" });
    window.history.pushState({}, "", "/?waitlist_source=nav");
    render(<WaitlistSection />);

    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "owner@business.test" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Join the waitlist" }));

    await waitFor(() => expect(submitMock).toHaveBeenCalledWith(expect.objectContaining({ source: "nav" })));
  });

  it("shows a friendly server error without clearing the form", async () => {
    submitMock.mockRejectedValue(new Error("We could not join the waitlist right now."));
    render(<WaitlistSection />);

    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "founder@lagosagency.test" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Join the waitlist" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We could not join the waitlist right now."
    );
    expect(screen.getByLabelText("Work email")).toHaveValue("founder@lagosagency.test");
  });
});
