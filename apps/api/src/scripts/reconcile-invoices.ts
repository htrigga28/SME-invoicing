import "dotenv/config";

import { ConfigService } from "@nestjs/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { inArray } from "drizzle-orm";
import { Pool } from "pg";

import { DatabaseService } from "../database/database.service";
import * as schema from "../database/schema";
import { invoices, payments } from "../database/schema";
import { PaystackService } from "../modules/paystack/paystack.service";
import { PaymentsService } from "../modules/payments/payments.service";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });
  const databaseService = { db } as unknown as DatabaseService;
  const configService = new ConfigService();
  const paymentsService = new PaymentsService(
    databaseService,
    configService,
    new PaystackService(configService)
  );

  try {
    const paymentRows = await db.select({ invoiceId: payments.invoiceId }).from(payments);
    const invoiceIds = Array.from(new Set(paymentRows.map((row) => row.invoiceId)));

    if (invoiceIds.length === 0) {
      console.log("Payment invoice reconciliation complete.");
      console.log("Invoices scanned: 0");
      console.log("Invoices corrected: 0");
      console.log("Status corrections: 0");
      console.log("Financial field corrections: 0");
      console.log("Overpayments detected: 0");
      return;
    }

    const invoiceRows = await db.select().from(invoices).where(inArray(invoices.id, invoiceIds));
    let corrected = 0;
    let statusCorrections = 0;
    let financialCorrections = 0;
    let overpayments = 0;

    for (const invoice of invoiceRows) {
      const before = {
        status: invoice.status,
        amountPaidKobo: invoice.amountPaidKobo,
        balanceDueKobo: invoice.balanceDueKobo
      };
      const result = await db.transaction((tx) =>
        paymentsService.recalculateInvoiceFinancialState(tx, invoice.id, {
          reason: "payment_financial_repair"
        })
      );
      const after = result.invoice;
      const statusChanged = before.status !== after.status;
      const financialChanged =
        before.amountPaidKobo !== after.amountPaidKobo ||
        before.balanceDueKobo !== after.balanceDueKobo;

      if (statusChanged || financialChanged) {
        corrected += 1;
      }

      if (statusChanged) {
        statusCorrections += 1;
      }

      if (financialChanged) {
        financialCorrections += 1;
      }

      if (result.financialSummary.hasOverpayment) {
        overpayments += 1;
      }
    }

    console.log("Payment invoice reconciliation complete.");
    console.log(`Invoices scanned: ${invoiceRows.length}`);
    console.log(`Invoices corrected: ${corrected}`);
    console.log(`Status corrections: ${statusCorrections}`);
    console.log(`Financial field corrections: ${financialCorrections}`);
    console.log(`Overpayments detected: ${overpayments}`);
  } finally {
    await pool.end();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
