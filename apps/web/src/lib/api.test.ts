import { afterEach, describe, expect, it } from "vitest";

import { getApiBaseUrl } from "./api";

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

afterEach(() => {
  if (originalApiUrl === undefined) {
    delete process.env.NEXT_PUBLIC_API_URL;
    return;
  }

  process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
});

describe("getApiBaseUrl", () => {
  it("uses the configured frontend API URL", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.test";

    expect(getApiBaseUrl()).toBe("https://api.example.test");
  });

  it("falls back to the local API URL", () => {
    delete process.env.NEXT_PUBLIC_API_URL;

    expect(getApiBaseUrl()).toBe("http://localhost:4000");
  });
});
