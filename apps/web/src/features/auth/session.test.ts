import { describe, expect, it, vi } from "vitest";

import {
  clearStoredSession,
  clearStoredOrganisationId,
  getLegacyStoredSession,
  getStoredOrganisationId,
  getStoredSession,
  scrubLegacyStoredSession,
  setStoredOrganisationId,
  setStoredSession,
  subscribeToStoredSession
} from "./session";

describe("browser session", () => {
  it("keeps the access token in memory and out of localStorage", () => {
    setStoredSession({ accessToken: "access-1" });

    expect(getStoredSession()).toEqual({ accessToken: "access-1" });
    expect(window.localStorage.getItem("sme-invoicing-session")).toBeNull();

    clearStoredSession();

    expect(getStoredSession()).toBeNull();
  });

  it("scrubs the legacy localStorage session shape", () => {
    window.localStorage.setItem(
      "sme-invoicing-session",
      JSON.stringify({ accessToken: "old", refreshToken: "old-refresh" })
    );

    scrubLegacyStoredSession();

    expect(window.localStorage.getItem("sme-invoicing-session")).toBeNull();
  });

  it("keeps a legacy credential until a successful caller explicitly scrubs it", () => {
    window.localStorage.setItem(
      "sme-invoicing-session",
      JSON.stringify({ accessToken: "old", refreshToken: "old-refresh" })
    );

    expect(getLegacyStoredSession()).toEqual({ accessToken: "old", refreshToken: "old-refresh" });
    setStoredSession({ accessToken: "renewed" });
    expect(window.localStorage.getItem("sme-invoicing-session")).not.toBeNull();

    scrubLegacyStoredSession();
    expect(window.localStorage.getItem("sme-invoicing-session")).toBeNull();
  });

  it("publishes renewed access tokens to the active session subscriber", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToStoredSession(listener);

    setStoredSession({ accessToken: "renewed" });
    clearStoredSession();
    unsubscribe();

    expect(listener).toHaveBeenNthCalledWith(1, { accessToken: "renewed" });
    expect(listener).toHaveBeenNthCalledWith(2, null);
  });

  it("persists only the non-credential workspace selection", () => {
    expect(getStoredOrganisationId()).toBeNull();

    setStoredOrganisationId("org-2");

    expect(getStoredOrganisationId()).toBe("org-2");
    expect(getStoredSession()).toBeNull();

    window.localStorage.removeItem("sme-invoicing-organisation");
  });

  it("clears a stale workspace selection without touching credentials", () => {
    setStoredSession({ accessToken: "access-1" });
    setStoredOrganisationId("org-2");

    clearStoredOrganisationId();

    expect(getStoredOrganisationId()).toBeNull();
    expect(getStoredSession()).toEqual({ accessToken: "access-1" });
  });
});
