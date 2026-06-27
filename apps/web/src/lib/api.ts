const DEFAULT_API_URL = "http://localhost:4000";

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;
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
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}

export async function apiGet<TResponse>(
  path: string,
  init?: ApiRequestOptions
): Promise<TResponse> {
  return apiRequest<TResponse>(path, { ...init, method: "GET" });
}
