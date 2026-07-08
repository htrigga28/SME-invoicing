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

  it("shows exports to operational roles but hides exports from viewers", () => {
    for (const role of ["owner", "admin", "accountant"] as const) {
      expect(getNavigationItems(role)).toEqual(
        expect.arrayContaining([expect.objectContaining({ href: "/exports", status: "available" })])
      );
    }

    expect(getNavigationItems("viewer")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ href: "/payments", status: "available" }),
        expect.objectContaining({ href: "/receipts", status: "available" })
      ])
    );
    expect(getNavigationItems("viewer").map((item) => item.label)).not.toContain("Exports");
  });

  it("does not mark exports or audit logs as coming soon for permitted roles", () => {
    expect(getNavigationItems("owner")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ href: "/exports", status: "available" }),
        expect.objectContaining({ href: "/audit-logs", status: "available" })
      ])
    );
  });
});
