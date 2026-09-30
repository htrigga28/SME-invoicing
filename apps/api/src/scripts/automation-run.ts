import "../config/load-root-env";

import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";

import { AppModule } from "../app.module";
import { AutomationRunnerService } from "../modules/automation/automation-runner.service";

async function main() {
  const asOfArg = process.argv.find((arg) => arg.startsWith("--as-of="));
  const asOf = asOfArg?.split("=")[1];
  if (asOf && !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    throw new Error("--as-of must be YYYY-MM-DD");
  }
  if (asOf && process.env.NODE_ENV === "production") {
    throw new Error("--as-of is for development/test only and must not run in production.");
  }
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn", "log"] });
  try {
    const runner = app.get(AutomationRunnerService);
    const config = app.get(ConfigService);
    if (!asOf) {
      const secret = config.get<string>("CRON_SECRET");
      if (!secret) {
        // Local runs without CRON_SECRET are allowed; the HTTP endpoint still fails closed.
        console.warn("CRON_SECRET is not set; running local executor anyway.");
      }
    }
    const summary = await runner.run(asOf);
    console.log(JSON.stringify(summary));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

