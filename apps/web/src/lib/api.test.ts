import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError, apiRequest, extractApiErrorMessage, getApiBaseUrl } from "./api";

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
        status: 401,
        text: vi.fn().mockResolvedValue("")
      })
    );

    await expect(apiRequest("/me")).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 401
    } satisfies Partial<ApiRequestError>);
  });

  it("uses the backend message when available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            message: "Unable to load Paystack banks. Check Paystack configuration."
          })
        )
      })
    );

    await expect(apiRequest("/payment-setup/banks")).rejects.toMatchObject({
      message: "Unable to load Paystack banks. Check Paystack configuration.",
      status: 503
    } satisfies Partial<ApiRequestError>);
  });

  it("falls back to friendly status messages when the backend payload is not useful", async () => {
    expect(extractApiErrorMessage(503, { error: "Service Unavailable" })).toBe(
      "The payment provider is currently unavailable. Please try again later."
    );
    expect(extractApiErrorMessage(404)).toBe("The requested record could not be found.");
  });
});
