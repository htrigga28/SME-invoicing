import { assertDemoSeedAllowed } from "./seed";

describe("demo seed guard", () => {
  it("requires explicit opt-in outside production", () => {
    expect(() => assertDemoSeedAllowed({ NODE_ENV: "development" })).toThrow(
      "ALLOW_DEMO_SEED=true"
    );
    expect(() =>
      assertDemoSeedAllowed({ NODE_ENV: "development", ALLOW_DEMO_SEED: "false" })
    ).toThrow("ALLOW_DEMO_SEED=true");
  });

  it("rejects production even when explicitly opted in", () => {
    expect(() =>
      assertDemoSeedAllowed({ NODE_ENV: "production", ALLOW_DEMO_SEED: "true" })
    ).toThrow("disabled in production");
  });

  it("allows an opted-in development seed", () => {
    expect(() =>
      assertDemoSeedAllowed({ NODE_ENV: "development", ALLOW_DEMO_SEED: "true" })
    ).not.toThrow();
  });
});
