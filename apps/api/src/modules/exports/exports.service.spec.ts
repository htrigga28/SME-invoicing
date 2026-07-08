import { UnprocessableEntityException } from "@nestjs/common";

import type { ActiveOrganisationContext } from "../../common/types/request-context";
import { ExportsService } from "./exports.service";

const context = {
  user: {
    id: "user-1",
    email: "owner@demo.com",
    name: "Demo Owner",
    createdAt: new Date("2026-07-08T00:00:00.000Z"),
    updatedAt: new Date("2026-07-08T00:00:00.000Z")
  },
  activeOrganisation: {
    id: "org-1",
    name: "Demo Org",
    slug: "demo-org",
    onboardingCompletedAt: new Date("2026-07-08T00:00:00.000Z"),
    createdAt: new Date("2026-07-08T00:00:00.000Z"),
    updatedAt: new Date("2026-07-08T00:00:00.000Z")
  },
  membership: {
    id: "member-1",
    organisationId: "org-1",
    userId: "user-1",
    role: "owner",
    status: "active",
    createdAt: new Date("2026-07-08T00:00:00.000Z"),
    updatedAt: new Date("2026-07-08T00:00:00.000Z")
  },
  businessProfile: {
    id: "profile-1",
    organisationId: "org-1",
    businessName: "Demo Org",
    email: "owner@demo.com",
    phone: null,
    address: null,
    logoFileId: null,
    setupCompletedAt: new Date("2026-07-08T00:00:00.000Z"),
    createdAt: new Date("2026-07-08T00:00:00.000Z"),
    updatedAt: new Date("2026-07-08T00:00:00.000Z")
  }
} satisfies ActiveOrganisationContext;

describe("ExportsService", () => {
  it("rejects exports over 10,000 rows without writing an audit event", async () => {
    const auditLogService = {
      create: jest.fn(),
      listAuditLogsForExport: jest.fn()
    };
    const service = new ExportsService(
      {} as never,
      auditLogService as never,
      {} as never,
      {} as never
    );

    await expect(
      (
        service as unknown as {
          createCsvExport: (input: {
            columns: { header: string; value: (row: { value: number }) => number }[];
            context: ActiveOrganisationContext;
            dataset: string;
            filters: object;
            rows: { value: number }[];
          }) => Promise<unknown>;
        }
      ).createCsvExport({
        columns: [{ header: "value", value: (row) => row.value }],
        context,
        dataset: "customers",
        filters: {},
        rows: Array.from({ length: 10_001 }, (_, value) => ({ value }))
      })
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(auditLogService.create).not.toHaveBeenCalled();
  });

  it("snapshots audit-log export rows before writing the export audit event", async () => {
    const auditLogService = {
      create: jest.fn().mockResolvedValue(undefined),
      listAuditLogsForExport: jest.fn().mockResolvedValue([
        {
          id: "audit-1",
          action: "invoice_sent",
          actionLabel: "Invoice Sent",
          category: "invoice",
          actor: { id: "user-1", name: "Demo Owner", email: "owner@demo.com" },
          actorLabel: "Demo Owner (owner@demo.com)",
          resource: { type: "invoice", id: "invoice-1", label: "INV-000001" },
          metadataSummary: "Invoice Number: INV-000001",
          metadataFields: [],
          createdAt: new Date("2026-07-08T12:00:00.000Z")
        }
      ])
    };
    const service = new ExportsService(
      {} as never,
      auditLogService as never,
      {} as never,
      {} as never
    );

    const result = await service.exportAuditLogs(context, {});

    expect(result.content).toContain("invoice_sent");
    expect(result.content).not.toContain("export_generated");
    expect(auditLogService.listAuditLogsForExport.mock.invocationCallOrder[0]).toBeLessThan(
      auditLogService.create.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
    expect(auditLogService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "export_generated",
        entityType: "export",
        metadataRedacted: expect.objectContaining({
          dataset: "audit-logs",
          rowCount: 1
        })
      })
    );
  });
});
