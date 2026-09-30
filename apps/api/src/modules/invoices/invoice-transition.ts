import { and, eq, inArray, type SQL } from "drizzle-orm";

import type { AppDatabase } from "../../database/database.service";
import { auditLogs, invoices, invoiceStatusEvents, type Invoice } from "../../database/schema";

type Transaction = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

/** Commit the state, status event, and audit record in the caller's transaction. */
export async function transitionInvoiceInTransaction(
  tx: Transaction,
  invoice: Invoice,
  input: {
    actorUserId: string | null;
    action: string;
    reason: string;
    metadata: Record<string, unknown>;
    patch: Partial<Invoice>;
    toStatus: Invoice["status"];
    expectedFromStatuses?: Invoice["status"][] | undefined;
    condition?: SQL;
  }
): Promise<Invoice | undefined> {
  const conditions = [
    eq(invoices.id, invoice.id),
    eq(invoices.organisationId, invoice.organisationId)
  ];
  if (input.expectedFromStatuses?.length)
    conditions.push(inArray(invoices.status, input.expectedFromStatuses));
  if (input.condition) conditions.push(input.condition);
  const [updated] = await tx
    .update(invoices)
    .set(input.patch)
    .where(and(...conditions))
    .returning();
  if (!updated) return undefined;
  await tx.insert(invoiceStatusEvents).values({
    organisationId: invoice.organisationId,
    invoiceId: invoice.id,
    fromStatus: invoice.status,
    toStatus: input.toStatus,
    reason: input.reason,
    actorUserId: input.actorUserId,
    metadataRedacted: input.metadata
  });
  await tx.insert(auditLogs).values({
    organisationId: invoice.organisationId,
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: "invoice",
    entityId: invoice.id,
    metadataRedacted: input.metadata
  });
  return updated;
}
