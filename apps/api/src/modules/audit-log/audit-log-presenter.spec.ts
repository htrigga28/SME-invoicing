import { categorizeAuditAction, presentAuditLog } from "./audit-log-presenter";

describe("audit log presenter", () => {
  it("maps known and future actions into stable categories", () => {
    expect(categorizeAuditAction("customer_created")).toBe("customer");
    expect(categorizeAuditAction("invoice_sent")).toBe("invoice");
    expect(categorizeAuditAction("payment_webhook_mismatch")).toBe("reconciliation");
    expect(categorizeAuditAction("payment_refund_initiated")).toBe("refund");
    expect(categorizeAuditAction("receipt_generated")).toBe("receipt");
    expect(categorizeAuditAction("export_generated")).toBe("export");
    expect(categorizeAuditAction("future_unknown_action")).toBe("system");
  });

  it("removes sensitive metadata while keeping safe masked fields", () => {
    const presented = presentAuditLog({
      actor: null,
      auditLog: {
        id: "audit-1",
        organisationId: "org-1",
        actorUserId: null,
        action: "payment_account_created",
        entityType: "payment_account",
        entityId: "00000000-0000-0000-0000-000000000001",
        metadataRedacted: {
          accountNumber: "0123456789",
          accountNumberLast4: "6789",
          providerSubaccountCode: "ACCT_secret",
          publicToken: "public-token",
          rawPayload: { authorization: "Bearer secret" },
          bankName: "Access Bank"
        },
        createdAt: new Date("2026-07-08T12:00:00.000Z")
      }
    });

    expect(presented.actorLabel).toBe("System");
    expect(presented.metadataSummary).toContain("Account Number Last4: 6789");
    expect(presented.metadataSummary).toContain("Bank Name: Access Bank");
    expect(JSON.stringify(presented)).not.toContain("0123456789");
    expect(JSON.stringify(presented)).not.toContain("ACCT_secret");
    expect(JSON.stringify(presented)).not.toContain("public-token");
    expect(JSON.stringify(presented)).not.toContain("Bearer secret");
  });
});
