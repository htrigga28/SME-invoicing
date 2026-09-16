import "../config/load-root-env";

import { ConfigService } from "@nestjs/config";

import { DatabaseService } from "../database/database.service";
import { ReceiptsService } from "../modules/receipts/receipts.service";

function readScope() {
  const args = process.argv.slice(2);
  const idIndex = args.indexOf("--organisation-id");
  const slugIndex = args.indexOf("--organisation-slug");
  const organisationId = idIndex >= 0 ? args[idIndex + 1] : process.env.RECEIPTS_ORGANISATION_ID;
  const organisationSlug =
    slugIndex >= 0 ? args[slugIndex + 1] : process.env.RECEIPTS_ORGANISATION_SLUG;

  if (organisationId) {
    return { organisationId } as const;
  }

  if (organisationSlug) {
    return { organisationSlug } as const;
  }

  throw new Error(
    "Receipt backfill requires --organisation-id, --organisation-slug, or an explicit RECEIPTS_ORGANISATION_* variable."
  );
}

async function main() {
  const configService = new ConfigService();
  const databaseService = new DatabaseService(configService);
  const receiptsService = new ReceiptsService(databaseService, configService);

  try {
    const result = await receiptsService.backfillReceipts(readScope());

    console.log(
      `Receipt backfill complete. Scanned: ${result.scanned}. Created: ${result.created}. Existing: ${result.existing}.`
    );
  } finally {
    await databaseService.onModuleDestroy();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
