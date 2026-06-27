import "dotenv/config";

import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;
const isGenerateCommand = process.argv.includes("generate");

if (!databaseUrl && !isGenerateCommand) {
  throw new Error("DATABASE_URL is required for Drizzle commands.");
}

export default defineConfig({
  schema: "./src/database/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl ?? "postgresql://placeholder@localhost:5432/placeholder"
  },
  strict: true,
  verbose: true
});
