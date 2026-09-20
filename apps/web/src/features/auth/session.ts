// Browser session state.
//
// Security model: the short-lived access token lives in module memory only —
// never in localStorage — so a successful XSS cannot exfiltrate it from
// storage. The long-lived refresh token lives in an HttpOnly cookie managed
// by the API and is never readable here. Only the selected workspace id (not
// a credential, always validated server-side) persists in localStorage.

export type StoredSession = {
  accessToken: string;
};

export type LegacyStoredSession = StoredSession & {
  refreshToken: string;
};

const LEGACY_SESSION_KEY = "sme-invoicing-session";
const ORGANISATION_KEY = "sme-invoicing-organisation";

let memoryAccessToken: string | null = null;
const listeners = new Set<(session: StoredSession | null) => void>();

export function getStoredSession(): StoredSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  return memoryAccessToken ? { accessToken: memoryAccessToken } : null;
}

export function setStoredSession(session: StoredSession) {
  memoryAccessToken = session.accessToken;
  publishSession();
}

export function clearStoredSession() {
  memoryAccessToken = null;
  publishSession();
}

export function subscribeToStoredSession(listener: (session: StoredSession | null) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLegacyStoredSession(): LegacyStoredSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(LEGACY_SESSION_KEY) ?? "null");

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Record<string, unknown>).accessToken === "string" &&
      typeof (parsed as Record<string, unknown>).refreshToken === "string"
    ) {
      return parsed as LegacyStoredSession;
    }
  } catch {
    // Leave malformed storage untouched. It might be recoverable by a prior client.
  }

  return null;
}

// One-time migration away from the pre-cookie session shape that kept both
// tokens in localStorage. Safe to call repeatedly.
export function scrubLegacyStoredSession() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    // Storage may be unavailable (private mode); the memory session stands alone.
  }
}

function publishSession() {
  const session = memoryAccessToken ? { accessToken: memoryAccessToken } : null;
  listeners.forEach((listener) => listener(session));
}

// The selected workspace id is not a credential, so plain localStorage is
// fine. It is always validated server-side against membership per request.
export function getStoredOrganisationId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(ORGANISATION_KEY);

  return stored && stored.trim() ? stored : null;
}

export function setStoredOrganisationId(organisationId: string) {
  window.localStorage.setItem(ORGANISATION_KEY, organisationId);
}

export function clearStoredOrganisationId() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ORGANISATION_KEY);
}
