import { describe, expect, it } from "vitest";

import { getNavigationItems, getNavigationSections } from "./navigation";

describe("authenticated navigation", () => {
  it("shows team and audit logs to owners", () => {
    const labels = getNavigationItems("owner").map((item) => item.label);

    expect(labels).toContain("Team");
    expect(labels).toContain("Audit Logs");
  });

  it("shows team and audit logs to admins", () => {
    const labels = getNavigationItems("admin").map((item) => item.label);

    expect(labels).toContain("Team");
    expect(labels).toContain("Audit Logs");
  });

  it("hides team and audit logs from accountants and viewers", () => {
    expect(getNavigationItems("accountant").map((item) => item.label)).not.toContain("Team");
    expect(getNavigationItems("accountant").map((item) => item.label)).not.toContain("Audit Logs");
    expect(getNavigationItems("viewer").map((item) => item.label)).not.toContain("Team");
    expect(getNavigationItems("viewer").map((item) => item.label)).not.toContain("Audit Logs");
  });

  it("shows payment setup to every authenticated role", () => {
    for (const role of ["owner", "admin", "accountant", "viewer"] as const) {
      expect(getNavigationItems(role)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            href: "/settings/payment-setup",
            label: "Payment Setup",
            status: "available"
          })
        ])
      );
    }
  });

  it("groups payment setup under Settings instead of the main navigation section", () => {
    const sections = getNavigationSections("owner");
    const main = sections.find((section) => section.label === "Main");
    const settings = sections.find((section) => section.label === "Settings");

    expect(main?.items.map((item) => item.label)).not.toContain("Payment Setup");
    expect(settings?.items.map((item) => item.label)).toEqual(
      expect.arrayContaining(["Team", "Payment Setup"])
    );
  });

  it("represents future modules as coming soon placeholders", () => {
    expect(getNavigationItems("viewer")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ href: "/payments", status: "coming-soon", task: "T013" }),
        expect.objectContaining({ href: "/receipts", status: "coming-soon", task: "T014" }),
        expect.objectContaining({ href: "/exports", status: "coming-soon", task: "T016" })
      ])
    );
  });
});
