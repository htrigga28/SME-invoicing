const DEFAULT_API_URL = "http://localhost:4000";

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
  503: "The payment provider is currently unavailable. Please try again later."
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
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;
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
  body?: unknown;
};

export async function apiRequest<TResponse>(
  path: string,
  init: ApiRequestOptions = {}
): Promise<TResponse> {
  const { accessToken, body, ...requestInit } = init;
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const request: RequestInit = {
    ...requestInit,
    headers
  };

  if (body !== undefined) {
    request.body = JSON.stringify(body);
  }

  const response = await fetch(new URL(path, getApiBaseUrl()), request);

  if (!response.ok) {
    const responseBody = await readApiErrorResponse(response);

    throw new ApiRequestError(
      extractApiErrorMessage(response.status, responseBody),
      response.status,
      responseBody
    );
  }

  return response.json() as Promise<TResponse>;
}

export async function apiGet<TResponse>(
  path: string,
  init?: ApiRequestOptions
): Promise<TResponse> {
  return apiRequest<TResponse>(path, { ...init, method: "GET" });
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
    /^(Bad Request|Unauthorized|Forbidden|Not Found|Conflict|Unprocessable Entity|Internal Server Error|Service Unavailable)( Exception)?$/i.test(
      message
    )
  ) {
    return null;
  }

  return message;
}
