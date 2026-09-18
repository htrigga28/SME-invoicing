import { describe, expect, it } from "vitest";

import { getNavigationItems, getNavigationSections } from "./navigation";

describe("authenticated navigation", () => {
  it("shows team and audit log to owners", () => {
    const labels = getNavigationItems("owner").map((item) => item.label);

    expect(labels).toContain("Team");
    expect(labels).toContain("Audit log");
  });

  it("shows team and audit log to admins", () => {
    const labels = getNavigationItems("admin").map((item) => item.label);

    expect(labels).toContain("Team");
    expect(labels).toContain("Audit log");
  });

  it("hides team and audit log from accountants and viewers", () => {
    expect(getNavigationItems("accountant").map((item) => item.label)).not.toContain("Team");
    expect(getNavigationItems("accountant").map((item) => item.label)).not.toContain("Audit log");
    expect(getNavigationItems("viewer").map((item) => item.label)).not.toContain("Team");
    expect(getNavigationItems("viewer").map((item) => item.label)).not.toContain("Audit log");
  });

  it("shows payment setup to every authenticated role", () => {
    for (const role of ["owner", "admin", "accountant", "viewer"] as const) {
      expect(getNavigationItems(role)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            href: "/settings/payment-setup",
            label: "Payment setup",
            status: "available"
          })
        ])
      );
    }
  });

  it("groups payment setup under Settings instead of receivables/operations", () => {
    const sections = getNavigationSections("owner");
    const receivables = sections.find((section) => section.label === "Receivables");
    const operations = sections.find((section) => section.label === "Operations");
    const settings = sections.find((section) => section.label === "Settings");

    expect(receivables?.items.map((item) => item.label)).not.toContain("Payment setup");
    expect(operations?.items.map((item) => item.label)).not.toContain("Payment setup");
    expect(settings?.items.map((item) => item.label)).toEqual(
      expect.arrayContaining(["Team", "Payment setup"])
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
