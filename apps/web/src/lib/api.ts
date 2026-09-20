import {
  getStoredOrganisationId,
  setStoredSession
} from "@/features/auth/session";

const DEFAULT_API_URL = "http://localhost:4000";
const NETWORK_ERROR_MESSAGE =
  "Lumina could not connect to the service. This part of the app is temporarily unavailable.";
const REQUEST_TIMEOUT_MESSAGE =
  "The request took too long. Please check your connection and try again.";
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const DOWNLOAD_REQUEST_TIMEOUT_MS = 60_000;

type ApiErrorPayload = {
  error?: unknown;
  message?: unknown;
};

const statusMessages: Record<number, string> = {
  400: "The request could not be completed. Please check the form and try again.",
  401: "Your session has expired. Please log in again.",
  403: "You do not have permission to perform this action.",
  404: "The requested record could not be found.",
  409: "This action conflicts with the current state of the record.",
  422: "Some details are invalid. Please review the form.",
  500: "Something went wrong on our side. Please try again.",
  503: "This service is temporarily unavailable. Try again in a moment."
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly responseBody?: ApiErrorPayload
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

export function getApiBaseUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (apiUrl) {
    return apiUrl;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_API_URL is required in production.");
  }

  return DEFAULT_API_URL;
}

export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again."
) {
  if (error instanceof ApiRequestError || error instanceof Error) {
    return error.message;
  }

  return fallback;
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  accessToken?: string;
  organisationId?: string | null | undefined;
  body?: unknown;
  timeoutMs?: number;
};

export const ORGANISATION_ID_HEADER = "x-organisation-id";

// Requests that must never trigger an access-token refresh: the credential
// endpoints themselves and unauthenticated public routes.
const NO_REFRESH_PATHS = ["/auth/", "/public/waitlist"];

// Single-flight refresh shared by concurrent 401s: only one rotation request
// is ever in flight however many calls expire at once.
let refreshPromise: Promise<string> | null = null;

function shouldRefreshRetry(path: string, hadAccessToken: boolean, status: number): boolean {
  if (status !== 401 || !hadAccessToken) {
    return false;
  }

  return !NO_REFRESH_PATHS.some((prefix) => path.startsWith(prefix));
}

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      // Cookie-authenticated: the HttpOnly refresh cookie travels with the
      // request, so no token ever passes through JavaScript here.
      const session = await apiRequest<{ accessToken: string }>("/auth/refresh", {
        method: "POST",
        body: {}
      });
      setStoredSession({ accessToken: session.accessToken });
      return session.accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function apiRequest<TResponse>(
  path: string,
  init: ApiRequestOptions = {}
): Promise<TResponse> {
  const { accessToken, body, organisationId, timeoutMs, ...requestInit } = init;
  const headers = new Headers(init.headers);

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const resolvedOrganisationId =
    organisationId === undefined ? getStoredOrganisationId() : organisationId;

  if (accessToken && resolvedOrganisationId) {
    headers.set(ORGANISATION_ID_HEADER, resolvedOrganisationId);
  }

  const request: RequestInit = {
    credentials: "include",
    ...requestInit,
    headers
  };

  if (body !== undefined) {
    request.body = JSON.stringify(body);
  }

  const response = await fetchApi(
    new URL(path, getApiBaseUrl()),
    request,
    timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
  );

  if (response.ok) {
    return response.json() as Promise<TResponse>;
  }

  if (shouldRefreshRetry(path, Boolean(accessToken), response.status)) {
    try {
      const renewed = await refreshAccessToken();
      headers.set("Authorization", `Bearer ${renewed}`);
      const retry = await fetchApi(
        new URL(path, getApiBaseUrl()),
        { ...request, headers },
        timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
      );

      if (retry.ok) {
        return retry.json() as Promise<TResponse>;
      }

      return throwApiError(retry);
    } catch (retryError) {
      if (retryError instanceof ApiRequestError) {
        throw retryError;
      }
      // Refresh itself failed: surface the original 401 so callers log out.
      return throwApiError(response);
    }
  }

  return throwApiError(response);
}

async function throwApiError(response: Response): Promise<never> {
  const responseBody = await readApiErrorResponse(response);

  throw new ApiRequestError(
    extractApiErrorMessage(response.status, responseBody),
    response.status,
    responseBody
  );
}

export async function apiGet<TResponse>(
  path: string,
  init?: ApiRequestOptions
): Promise<TResponse> {
  return apiRequest<TResponse>(path, { ...init, method: "GET" });
}

export async function apiDownload(
  path: string,
  init: Omit<ApiRequestOptions, "body"> = {}
): Promise<{ blob: Blob; filename: string | null }> {
  const { accessToken, organisationId, timeoutMs, ...requestInit } = init;
  const headers = new Headers(init.headers);

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const resolvedOrganisationId =
    organisationId === undefined ? getStoredOrganisationId() : organisationId;

  if (accessToken && resolvedOrganisationId) {
    headers.set(ORGANISATION_ID_HEADER, resolvedOrganisationId);
  }

  const request: RequestInit = {
    credentials: "include",
    ...requestInit,
    method: requestInit.method ?? "GET",
    headers
  };
  let response = await fetchApi(
    new URL(path, getApiBaseUrl()),
    request,
    timeoutMs ?? DOWNLOAD_REQUEST_TIMEOUT_MS
  );

  if (shouldRefreshRetry(path, Boolean(accessToken), response.status)) {
    try {
      const renewed = await refreshAccessToken();
      headers.set("Authorization", `Bearer ${renewed}`);
      response = await fetchApi(
        new URL(path, getApiBaseUrl()),
        { ...request, headers },
        timeoutMs ?? DOWNLOAD_REQUEST_TIMEOUT_MS
      );
    } catch (refreshError) {
      if (refreshError instanceof ApiRequestError) {
        throw refreshError;
      }

      return throwApiError(response);
    }
  }

  if (!response.ok) {
    return throwApiError(response);
  }

  return {
    blob: await response.blob(),
    filename: getDownloadFilename(response.headers.get("Content-Disposition"))
  };
}

async function fetchApi(input: URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const abortForCaller = () => controller.abort(init.signal?.reason);
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  init.signal?.addEventListener("abort", abortForCaller, { once: true });

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      throw new ApiRequestError(REQUEST_TIMEOUT_MESSAGE, 0);
    }

    if (error instanceof TypeError) {
      throw new ApiRequestError(NETWORK_ERROR_MESSAGE, 0);
    }

    throw error;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", abortForCaller);
  }
}

export function extractApiErrorMessage(status: number, responseBody?: ApiErrorPayload) {
  const message = getUsefulMessage(responseBody?.message);

  if (message) {
    return message;
  }

  const error = getUsefulMessage(responseBody?.error);

  if (error) {
    return error;
  }

  return statusMessages[status] ?? "Something went wrong. Please try again.";
}

async function readApiErrorResponse(response: Response) {
  const body = await response.text();

  if (!body) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(body) as ApiErrorPayload;

    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function getUsefulMessage(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const message = value.trim();

  if (!message) {
    return null;
  }

  if (
    /^API request failed with status \d+$/i.test(message) ||
    /(failed to fetch|network(?:error| request failed)|connection (?:was )?terminated unexpectedly|econn(?:reset|refused)|socket hang up)/i.test(
      message
    ) ||
    /^(Bad Request|Unauthorized|Forbidden|Not Found|Conflict|Unprocessable Entity|Internal Server Error|Service Unavailable)( Exception)?$/i.test(
      message
    )
  ) {
    return null;
  }

  return message;
}

function getDownloadFilename(contentDisposition: string | null) {
  if (!contentDisposition) {
    return null;
  }

  const encodedMatch = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);

  if (encodedMatch?.[1]) {
    return decodeURIComponent(encodedMatch[1].replaceAll('"', ""));
  }

  const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
  return match?.[1] ?? null;
}
