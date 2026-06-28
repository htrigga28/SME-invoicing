import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError, apiRequest, getApiBaseUrl } from "./api";

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

afterEach(() => {
  vi.unstubAllGlobals();

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

  it("throws a typed error with response status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401
      })
    );

    await expect(apiRequest("/me")).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 401
    } satisfies Partial<ApiRequestError>);
  });
});
