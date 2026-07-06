import "dotenv/config";

import { ConfigService } from "@nestjs/config";

import { DatabaseService } from "../database/database.service";
import { ReceiptsService } from "../modules/receipts/receipts.service";

async function main() {
  const configService = new ConfigService();
  const databaseService = new DatabaseService(configService);
  const receiptsService = new ReceiptsService(databaseService, configService);

  try {
    const result = await receiptsService.backfillReceipts();

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
