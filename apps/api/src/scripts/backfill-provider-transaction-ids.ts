import "../config/load-root-env";

import { ConfigService } from "@nestjs/config";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../database/schema";
import { payments } from "../database/schema";
import {
  PaystackService,
  type PaystackVerifyResponse
} from "../modules/paystack/paystack.service";

const paystackProvider = "paystack";

export type ProviderTransactionIdRepairCandidate = {
  amountKobo: number;
  currency: string;
  id: string;
  providerReference: string;
};

export type ProviderTransactionIdRepairDeps = {
  listMissing: () => Promise<ProviderTransactionIdRepairCandidate[]>;
  log: (message: string) => void;
  persist: (paymentId: string, providerTransactionId: string) => Promise<boolean>;
  verifyTransaction: (reference: string) => Promise<PaystackVerifyResponse>;
};

export type ProviderTransactionIdRepairSummary = {
  failed: number;
  repaired: number;
  scanned: number;
  skipped: number;
};

/**
 * One-time repair for successful Paystack payments that predate
 * `payments.provider_transaction_id` (migration 0018).
 *
 * Rows are only repaired from exact Paystack Verify Transaction evidence:
 * matching reference, successful provider status, matching amount and currency,
 * and a valid provider transaction ID. Rows without exact evidence are left
 * unchanged, and rows with an existing transaction ID are never overwritten.
 */
export async function backfillProviderTransactionIds(
  deps: ProviderTransactionIdRepairDeps
): Promise<ProviderTransactionIdRepairSummary> {
  const candidates = await deps.listMissing();
  const summary: ProviderTransactionIdRepairSummary = {
    failed: 0,
    repaired: 0,
    scanned: candidates.length,
    skipped: 0
  };

  for (const candidate of candidates) {
    let verification: PaystackVerifyResponse;

    try {
      verification = await deps.verifyTransaction(candidate.providerReference);
    } catch {
      summary.failed += 1;
      deps.log(`Verification unavailable for payment ${candidate.id}; row left unchanged.`);
      continue;
    }

    const transactionId = verification.providerTransactionId?.trim() ?? "";
    const evidenceMatches =
      verification.reference === candidate.providerReference &&
      verification.status.trim().toLowerCase() === "success" &&
      verification.amountKobo === candidate.amountKobo &&
      verification.currency === candidate.currency &&
      transactionId.length > 0;

    if (!evidenceMatches) {
      summary.skipped += 1;
      deps.log(`Provider evidence did not match payment ${candidate.id}; row left unchanged.`);
      continue;
    }

    const persisted = await deps.persist(candidate.id, transactionId);

    if (persisted) {
      summary.repaired += 1;
    } else {
      summary.skipped += 1;
      deps.log(`Payment ${candidate.id} was already repaired; row left unchanged.`);
    }
  }

  return summary;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });
  const paystackService = new PaystackService(new ConfigService());

  try {
    const summary = await backfillProviderTransactionIds({
      listMissing: () =>
        db
          .select({
            amountKobo: payments.amountKobo,
            currency: payments.currency,
            id: payments.id,
            providerReference: payments.providerReference
          })
          .from(payments)
          .where(
            and(
              eq(payments.provider, paystackProvider),
              eq(payments.status, "successful"),
              isNull(payments.providerTransactionId)
            )
          ),
      log: (message) => console.log(message),
      persist: async (paymentId, providerTransactionId) => {
        const updated = await db
          .update(payments)
          .set({ providerTransactionId, updatedAt: new Date() })
          .where(and(eq(payments.id, paymentId), isNull(payments.providerTransactionId)))
          .returning({ id: payments.id });

        return updated.length > 0;
      },
      verifyTransaction: (reference) => paystackService.verifyTransaction(reference)
    });

    console.log("Provider transaction ID backfill complete.");
    console.log(`Scanned: ${summary.scanned}`);
    console.log(`Repaired: ${summary.repaired}`);
    console.log(`Skipped: ${summary.skipped}`);
    console.log(`Failed: ${summary.failed}`);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
