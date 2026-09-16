import { validateEnv } from "./env.validation";

const productionConfig = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://example.invalid/lumina",
  JWT_ACCESS_SECRET: "production-access-secret",
  JWT_REFRESH_SECRET: "production-refresh-secret",
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

  it("keeps local defaults outside production", () => {
    expect(validateEnv({ NODE_ENV: "test" })).toMatchObject({
      CORS_ORIGINS: "http://localhost:3000,http://localhost:3002",
      JWT_ACCESS_SECRET: "dev-access-secret-change-me",
      JWT_REFRESH_SECRET: "dev-refresh-secret-change-me"
    });
  });
});
