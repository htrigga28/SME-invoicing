export const REFRESH_COOKIE_NAME = "lumina_rt";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export type CookieResponse = {
  cookie: (
    name: string,
    value: string,
    options: { httpOnly: boolean; path: string; sameSite: "lax"; secure: boolean; maxAge: number }
  ) => void;
  clearCookie: (
    name: string,
    options: { httpOnly: boolean; path: string; sameSite: "lax"; secure: boolean }
  ) => void;
};

export type CookieRequest = {
  headers: {
    cookie?: string | string[] | undefined;
    origin?: string | string[] | undefined;
  };
};

function cookieAttributes(secure: boolean) {
  return { httpOnly: true, path: "/", sameSite: "lax" as const, secure };
}

export function setRefreshCookie(res: CookieResponse, token: string, secure: boolean) {
  res.cookie(REFRESH_COOKIE_NAME, token, { ...cookieAttributes(secure), maxAge: THIRTY_DAYS_MS });
}

export function clearRefreshCookie(res: CookieResponse, secure: boolean) {
  res.clearCookie(REFRESH_COOKIE_NAME, cookieAttributes(secure));
}

export function readRefreshCookie(req: CookieRequest): string | undefined {
  const header = Array.isArray(req.headers.cookie) ? req.headers.cookie[0] : req.headers.cookie;

  if (!header) {
    return undefined;
  }

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");

    if (separator < 0) {
      continue;
    }

    if (part.slice(0, separator).trim() === REFRESH_COOKIE_NAME) {
      const value = part.slice(separator + 1).trim();

      try {
        return value ? decodeURIComponent(value) : undefined;
      } catch {
        return undefined;
      }
    }
  }

  return undefined;
}

export function readRequestOrigin(req: CookieRequest): string | undefined {
  const origin = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;

  return origin?.trim() ? origin.trim() : undefined;
}
