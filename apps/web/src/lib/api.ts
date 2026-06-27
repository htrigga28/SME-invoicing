const DEFAULT_API_URL = "http://localhost:4000";

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;
}

export async function apiGet<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
  const response = await fetch(new URL(path, getApiBaseUrl()), {
    ...init,
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}
