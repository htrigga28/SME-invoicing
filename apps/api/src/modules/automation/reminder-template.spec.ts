import {
  assertValidReminderTemplate,
  extractTemplateVariables,
  renderReminderTemplate
} from "./reminder-template";

describe("reminder-template", () => {
  it("extracts variables", () => {
    expect(extractTemplateVariables("Hello {{customerName}}, {{invoiceNumber}}")).toEqual([
      "customerName",
      "invoiceNumber"
    ]);
  });

  it("rejects unknown variables", () => {
    expect(() => assertValidReminderTemplate("Hi {{hacker}}", "Message")).toThrow(/unknown variable/);
  });

  it("renders all supported variables", () => {
    const out = renderReminderTemplate("Hi {{customerName}}, {{invoiceNumber}} {{amountDue}} {{dueDate}} {{businessName}} {{publicInvoiceUrl}}", {
      businessName: "Adebayo Studio",
      customerName: "Northstar",
      invoiceNumber: "INV-000184",
      amountDue: "₦78,400.00",
      dueDate: "2026-09-30",
      publicInvoiceUrl: "https://app.example/invoice/abc"
    });
    expect(out).toContain("Northstar");
    expect(out).toContain("INV-000184");
  });

  it("escapes HTML in html renderer", async () => {
    const { renderReminderHtml } = await import("./reminder-template");
    const html = renderReminderHtml("Hi {{customerName}}", {
      businessName: "A",
      customerName: "<script>alert(1)</script>",
      invoiceNumber: "INV-1",
      amountDue: "₦1.00",
      dueDate: "2026-09-30",
      publicInvoiceUrl: "https://app.example/i/1"
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});


