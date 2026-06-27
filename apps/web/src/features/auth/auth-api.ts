import { apiGet, apiRequest } from "@/lib/api";

import type { AuthResponse, BusinessProfile, MeResponse } from "./types";

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

export function getMe(accessToken: string) {
  return apiGet<MeResponse>("/me", { accessToken });
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

export function logout(refreshToken: string) {
  return apiRequest<{ success: true }>("/auth/logout", {
    method: "POST",
    body: { refreshToken }
  });
}
