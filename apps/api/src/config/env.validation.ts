import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_WEBHOOK_SECRET: z.string().optional(),
  FRONTEND_APP_URL: z.string().url().optional(),
  CORS_ORIGINS: z.string().default("http://localhost:3000")
});

export function validateEnv(config: Record<string, unknown>) {
  return envSchema.parse(config);
}
