import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ApiRequestError,
  apiDownload,
  apiRequest,
  extractApiErrorMessage,
  getApiBaseUrl
} from "./api";

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

  it("replaces browser network errors with a recoverable message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(apiRequest("/customers")).rejects.toMatchObject({
      message:
        "Lumina could not connect to the service. This part of the app is temporarily unavailable.",
      name: "ApiRequestError",
      status: 0
    } satisfies Partial<ApiRequestError>);
  });

  it("falls back to friendly status messages when the backend payload is not useful", async () => {
    expect(extractApiErrorMessage(503, { error: "Service Unavailable" })).toBe(
      "This service is temporarily unavailable. Try again in a moment."
    );
    expect(extractApiErrorMessage(500, { message: "connection terminated unexpectedly" })).toBe(
      "Something went wrong on our side. Please try again."
    );
    expect(extractApiErrorMessage(404)).toBe("The requested record could not be found.");
  });

  it("sends the selected workspace header when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/me", { accessToken: "token", organisationId: "org-2" });

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get("x-organisation-id")).toBe("org-2");
  });

  it("sends JSON content type only when it sends a JSON body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/me");
    await apiRequest("/auth/login", { method: "POST", body: { email: "owner@example.test" } });

    const getHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    const postHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Headers;
    expect(getHeaders.get("Content-Type")).toBeNull();
    expect(postHeaders.get("Content-Type")).toBe("application/json");
  });

  it("can deliberately omit a stale workspace header during recovery", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    });
    vi.stubGlobal("fetch", fetchMock);
    window.localStorage.setItem("sme-invoicing-organisation", "org-stale");

    try {
      await apiRequest("/me/organisations", { accessToken: "token", organisationId: null });
      const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
      expect(headers.get("x-organisation-id")).toBeNull();
    } finally {
      window.localStorage.removeItem("sme-invoicing-organisation");
    }
  });

  it("attaches the stored workspace selection automatically", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    });
    vi.stubGlobal("fetch", fetchMock);
    window.localStorage.setItem("sme-invoicing-organisation", "org-9");

    try {
      await apiRequest("/me", { accessToken: "token" });

      const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
      expect(headers.get("x-organisation-id")).toBe("org-9");
    } finally {
      window.localStorage.removeItem("sme-invoicing-organisation");
    }
  });

  it("refreshes once on 401 and retries the original request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401, text: vi.fn().mockResolvedValue("") })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ accessToken: "renewed" })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: "org-1" })
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiRequest<{ id: string }>("/me", { accessToken: "expired" });

    expect(result).toEqual({ id: "org-1" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const retryHeaders = fetchMock.mock.calls[2]?.[1]?.headers as Headers;
    expect(retryHeaders.get("Authorization")).toBe("Bearer renewed");
  });

  it("shares one refresh across concurrent 401s", async () => {
    let refreshCalls = 0;
    const fetchMock = vi.fn((input: URL) => {
      if (String(input).endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ accessToken: "renewed" })
        });
      }

      if (refreshCalls > 0) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
      }

      return Promise.resolve({ ok: false, status: 401, text: () => Promise.resolve("") });
    });
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([
      apiRequest("/me", { accessToken: "expired" }),
      apiRequest("/customers", { accessToken: "expired" })
    ]);

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(refreshCalls).toBe(1);
  });

  it("does not refresh credential endpoints on 401", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: vi.fn().mockResolvedValue("")
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      apiRequest("/auth/login", { method: "POST", body: {} })
    ).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces the original 401 when refresh fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401, text: vi.fn().mockResolvedValue("") })
      .mockResolvedValueOnce({ ok: false, status: 401, text: vi.fn().mockResolvedValue("") });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/me", { accessToken: "expired" })).rejects.toMatchObject({
      status: 401
    });
  });

  it("times out a hanging request while retaining a caller-provided abort signal", async () => {
    const fetchMock = vi.fn((_input: URL, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/me", { timeoutMs: 1 })).rejects.toMatchObject({
      message: "The request took too long. Please check your connection and try again.",
      status: 0
    });
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("downloads blobs with auth headers and content-disposition filename", async () => {
    const blob = new Blob(["csv"]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(blob),
      headers: new Headers({
        "Content-Disposition": 'attachment; filename="invoices-2026-07-08.csv"'
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await apiDownload("/exports/invoices.csv", { accessToken: "token" });

    expect(fetchMock).toHaveBeenCalledWith(
      new URL("http://localhost:4000/exports/invoices.csv"),
      expect.objectContaining({
        headers: expect.any(Headers)
      })
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer token");
    expect(response).toEqual({
      blob,
      filename: "invoices-2026-07-08.csv"
    });
  });

  it("refreshes once before retrying an expired download with the workspace header", async () => {
    const blob = new Blob(["csv"]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401, text: vi.fn().mockResolvedValue("") })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ accessToken: "renewed" })
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: vi.fn().mockResolvedValue(blob),
        headers: new Headers()
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      apiDownload("/exports/invoices.csv", { accessToken: "expired", organisationId: "org-2" })
    ).resolves.toMatchObject({ blob });

    const retryHeaders = fetchMock.mock.calls[2]?.[1]?.headers as Headers;
    expect(retryHeaders.get("Authorization")).toBe("Bearer renewed");
    expect(retryHeaders.get("x-organisation-id")).toBe("org-2");
  });
});
