import { apiGet, apiRequest } from "@/lib/api";

import type { AuthResponse, BusinessProfile, MeResponse, OrganisationsResponse } from "./types";

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type BusinessProfileInput = {
  businessName: string;
  email: string;
  phone: string;
  address: string;
  logoFileId?: string;
};

export function register(input: RegisterInput) {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: input
  });
}

export function login(input: LoginInput) {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: input
  });
}

export function getMe(accessToken: string, organisationId?: string | null) {
  return apiGet<MeResponse>("/me", { accessToken, organisationId });
}

export function getOrganisations(accessToken: string, organisationId?: string | null) {
  return apiGet<OrganisationsResponse>("/me/organisations", { accessToken, organisationId });
}

export function selectOrganisation(accessToken: string, organisationId: string) {
  return apiRequest<MeResponse>("/session/organisation", {
    method: "POST",
    accessToken,
    organisationId,
    body: { organisationId }
  });
}

export function getBusinessProfile(accessToken: string) {
  return apiGet<{ businessProfile: BusinessProfile }>("/business-profile", { accessToken });
}

export function updateBusinessProfile(accessToken: string, input: BusinessProfileInput) {
  return apiRequest<{ businessProfile: BusinessProfile; onboardingCompleted: boolean }>(
    "/business-profile",
    {
      method: "PATCH",
      accessToken,
      body: input
    }
  );
}

export function refresh(legacyRefreshToken?: string) {
  // Cookie-authenticated: the HttpOnly refresh cookie travels with the
  // request, so the long-lived credential never passes through JavaScript.
  return apiRequest<{ accessToken: string }>("/auth/refresh", {
    method: "POST",
    body: legacyRefreshToken ? { refreshToken: legacyRefreshToken } : {}
  });
}

export function logout() {
  return apiRequest<{ success: true }>("/auth/logout", {
    method: "POST",
    body: {}
  });
}
