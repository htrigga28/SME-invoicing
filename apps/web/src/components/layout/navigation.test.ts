import { describe, expect, it } from "vitest";

import { getNavigationItems } from "./navigation";

describe("authenticated navigation", () => {
  it("shows team and audit logs to owners", () => {
    const labels = getNavigationItems("owner").map((item) => item.label);

    expect(labels).toContain("Settings / Team");
    expect(labels).toContain("Audit Logs");
  });

  it("shows team and audit logs to admins", () => {
    const labels = getNavigationItems("admin").map((item) => item.label);

    expect(labels).toContain("Settings / Team");
    expect(labels).toContain("Audit Logs");
  });

  it("hides team and audit logs from accountants and viewers", () => {
    expect(getNavigationItems("accountant").map((item) => item.label)).not.toContain(
      "Settings / Team"
    );
    expect(getNavigationItems("accountant").map((item) => item.label)).not.toContain("Audit Logs");
    expect(getNavigationItems("viewer").map((item) => item.label)).not.toContain("Settings / Team");
    expect(getNavigationItems("viewer").map((item) => item.label)).not.toContain("Audit Logs");
  });

  it("represents future modules as coming soon placeholders", () => {
    expect(getNavigationItems("viewer")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ href: "/customers", status: "coming-soon", task: "T005" }),
        expect.objectContaining({ href: "/invoices", status: "coming-soon", task: "T006" }),
        expect.objectContaining({ href: "/payments", status: "coming-soon", task: "T010" }),
        expect.objectContaining({ href: "/receipts", status: "coming-soon", task: "T011" }),
        expect.objectContaining({ href: "/exports", status: "coming-soon", task: "T013" })
      ])
    );
  });
});
