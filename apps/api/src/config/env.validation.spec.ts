import { validateEnv } from "./env.validation";

const productionConfig = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://example.invalid/lumina",
  JWT_ACCESS_SECRET: "production-access-secret-32-chars-min",
  JWT_REFRESH_SECRET: "production-refresh-secret-32-chars!",
  PAYSTACK_SECRET_KEY: "paystack-secret",
  FRONTEND_APP_URL: "https://app.example.test",
  MARKETING_SITE_URL: "https://www.example.test",
  API_PUBLIC_URL: "https://api.example.test",
  CORS_ORIGINS: "https://app.example.test,https://www.example.test"
};

describe("validateEnv", () => {
  it("accepts a complete production configuration", () => {
    expect(validateEnv(productionConfig)).toMatchObject(productionConfig);
  });

  it("rejects missing production secrets and URLs", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        CORS_ORIGINS: "https://app.example.test"
      })
    ).toThrow(/DATABASE_URL/);
  });

  it("rejects development JWT defaults in production", () => {
    expect(() =>
      validateEnv({
        ...productionConfig,
        JWT_ACCESS_SECRET: "dev-access-secret-change-me"
      })
    ).toThrow(/Development JWT secrets/);
  });

  it("rejects localhost CORS origins in production", () => {
    expect(() =>
      validateEnv({
        ...productionConfig,
        CORS_ORIGINS: "https://app.example.test,https://localhost:3000"
      })
    ).toThrow(/CORS_ORIGINS/);
  });

  it.each(["*", "http://app.example.test", "not-an-origin"])(
    "rejects unsafe production CORS origin %s",
    (origin) => {
      expect(() =>
        validateEnv({
          ...productionConfig,
          CORS_ORIGINS: origin
        })
      ).toThrow(/CORS_ORIGINS/);
    }
  );

  it("requires HTTPS public URLs in production", () => {
    expect(() =>
      validateEnv({
        ...productionConfig,
        API_PUBLIC_URL: "http://api.example.test"
      })
    ).toThrow(/HTTPS/);
  });

  it("rejects short production JWT secrets", () => {
    expect(() =>
      validateEnv({
        ...productionConfig,
        JWT_ACCESS_SECRET: "too-short"
      })
    ).toThrow(/JWT_ACCESS_SECRET must be at least 32 characters/);
  });

  it("requires the Brevo webhook secret whenever sending is configured", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "test",
        BREVO_API_KEY: "brevo-key",
        BREVO_FROM_EMAIL: "billing@example.test"
      })
    ).toThrow(/BREVO_WEBHOOK_SECRET is required/);
    expect(
      validateEnv({
        NODE_ENV: "test",
        BREVO_API_KEY: "brevo-key",
        BREVO_FROM_EMAIL: "billing@example.test",
        BREVO_WEBHOOK_SECRET: "webhook-secret"
      })
    ).toMatchObject({ BREVO_WEBHOOK_SECRET: "webhook-secret" });
  });

  it("rejects identical production JWT secrets", () => {
    expect(() =>
      validateEnv({
        ...productionConfig,
        JWT_REFRESH_SECRET: productionConfig.JWT_ACCESS_SECRET
      })
    ).toThrow(/must be distinct/);
  });

  it("keeps local defaults outside production", () => {
    expect(validateEnv({ NODE_ENV: "test" })).toMatchObject({
      CORS_ORIGINS: "http://localhost:3000,http://localhost:3002",
      JWT_ACCESS_SECRET: "dev-access-secret-change-me",
      JWT_REFRESH_SECRET: "dev-refresh-secret-change-me"
    });
  });
});
