import { sql } from "drizzle-orm";
import type { AppDatabase } from "../database/database.service";

type Transaction = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];
export type InvoiceSequenceExecutor = Pick<Transaction, "execute">;

export async function nextInvoiceNumber(
  tx: InvoiceSequenceExecutor,
  organisationId: string
): Promise<string> {
  const result = await tx.execute<{ sequence_number: number }>(sql`
    insert into invoice_number_sequences (organisation_id, next_number, updated_at)
    values (${organisationId}, 2, now())
    on conflict (organisation_id)
    do update set next_number = invoice_number_sequences.next_number + 1, updated_at = now()
    returning next_number - 1 as sequence_number
  `);
  const sequenceNumber = Number(result.rows[0]?.sequence_number);
  if (!Number.isSafeInteger(sequenceNumber) || sequenceNumber < 1) {
    throw new Error("Invoice number generation failed.");
  }
  return `INV-${String(sequenceNumber).padStart(6, "0")}`;
}
