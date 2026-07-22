import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().optional(),
  TEST_DATABASE_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().default("dev-access-secret-change-me"),
  JWT_REFRESH_SECRET: z.string().default("dev-refresh-secret-change-me"),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_BASE_URL: z.string().url().optional(),
  PAYSTACK_WEBHOOK_SECRET: z.string().optional(),
  FRONTEND_APP_URL: z.string().url().optional(),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:3002"),
  TRUST_PROXY: z.string().min(1).default("loopback")
});

export function validateEnv(config: Record<string, unknown>) {
  return envSchema.parse(config);
}
