import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1).optional(),
  TEST_DATABASE_URL: z.string().min(1).optional(),
  JWT_ACCESS_SECRET: z.string().default("dev-access-secret-change-me"),
  JWT_REFRESH_SECRET: z.string().default("dev-refresh-secret-change-me"),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_BASE_URL: z.string().url().optional(),
  PAYSTACK_WEBHOOK_SECRET: z.string().optional(),
  FRONTEND_APP_URL: z.string().url().optional(),
  MARKETING_SITE_URL: z.string().url().optional(),
  API_PUBLIC_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  RESEND_WEBHOOK_SECRET: z.string().min(1).optional(),
  RESEND_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(15000),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:3002"),
  TRUST_PROXY: z.string().min(1).default("loopback"),
  // Compat window for pre-cookie clients that still POST the refresh token in
  // the body. New clients use the HttpOnly cookie. Disabled by default: enable
  // temporarily only while pre-cookie clients remain, then remove the
  // body-token flow entirely. Every legacy use is logged while enabled.
  LEGACY_REFRESH_BODY_ENABLED: z.string().default("false")
});

export function validateEnv(config: Record<string, unknown>) {
  const parsed = envSchema.parse(config);

  // Fail-closed in every environment: outbound email without the webhook
  // secret means every delivery event is rejected and silently lost.
  if ((parsed.RESEND_API_KEY || parsed.RESEND_FROM_EMAIL) && !parsed.RESEND_WEBHOOK_SECRET) {
    throw new Error(
      "RESEND_WEBHOOK_SECRET is required when Resend sending is configured (RESEND_API_KEY/RESEND_FROM_EMAIL)."
    );
  }

  if (parsed.NODE_ENV !== "production") {
    return parsed;
  }

  const requiredProductionValues = {
    API_PUBLIC_URL: parsed.API_PUBLIC_URL,
    CORS_ORIGINS: parsed.CORS_ORIGINS,
    DATABASE_URL: parsed.DATABASE_URL,
    FRONTEND_APP_URL: parsed.FRONTEND_APP_URL,
    JWT_ACCESS_SECRET: parsed.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: parsed.JWT_REFRESH_SECRET,
    MARKETING_SITE_URL: parsed.MARKETING_SITE_URL,
    PAYSTACK_SECRET_KEY: parsed.PAYSTACK_SECRET_KEY
  };
  const missing = Object.entries(requiredProductionValues)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }

  const corsOrigins = parsed.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const unsafeOrigins = corsOrigins.filter((origin) => {
    if (origin === "*") {
      return true;
    }

    try {
      const url = new URL(origin);
      return (
        url.protocol !== "https:" ||
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname.toLowerCase())
      );
    } catch {
      return true;
    }
  });

  if (unsafeOrigins.length > 0) {
    throw new Error(
      "CORS_ORIGINS must contain only explicit HTTPS origins in production; wildcard and local origins are forbidden."
    );
  }

  const publicUrls = {
    API_PUBLIC_URL: parsed.API_PUBLIC_URL,
    FRONTEND_APP_URL: parsed.FRONTEND_APP_URL,
    MARKETING_SITE_URL: parsed.MARKETING_SITE_URL
  };
  const insecurePublicUrls = Object.entries(publicUrls)
    .filter(([, value]) => value && new URL(value).protocol !== "https:")
    .map(([key]) => key);

  if (insecurePublicUrls.length > 0) {
    throw new Error(`Production public URLs must use HTTPS: ${insecurePublicUrls.join(", ")}`);
  }

  if (
    parsed.JWT_ACCESS_SECRET === "dev-access-secret-change-me" ||
    parsed.JWT_REFRESH_SECRET === "dev-refresh-secret-change-me"
  ) {
    throw new Error("Development JWT secrets must not be used in production.");
  }

  for (const [key, value] of [
    ["JWT_ACCESS_SECRET", parsed.JWT_ACCESS_SECRET],
    ["JWT_REFRESH_SECRET", parsed.JWT_REFRESH_SECRET]
  ] as const) {
    if (value.length < 32) {
      throw new Error(`${key} must be at least 32 characters in production.`);
    }
  }

  if (parsed.JWT_ACCESS_SECRET === parsed.JWT_REFRESH_SECRET) {
    throw new Error("JWT access and refresh secrets must be distinct in production.");
  }

  return parsed;
}
