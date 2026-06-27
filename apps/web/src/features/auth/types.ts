export type SafeUser = {
  id: string;
  email: string;
  name: string;
};

export type Organisation = {
  id: string;
  name: string;
  slug: string;
  onboardingCompletedAt: string | null;
};

export type Membership = {
  id: string;
  organisationId: string;
  userId: string;
  role: "owner" | "admin" | "accountant" | "viewer";
  status: "active" | "suspended" | "removed";
};

export type BusinessProfile = {
  id: string;
  organisationId: string;
  businessName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logoFileId: string | null;
  setupCompletedAt: string | null;
};

export type AuthResponse = {
  user: SafeUser;
  activeOrganisation: Organisation;
  membership: Membership;
  businessProfile: BusinessProfile;
  accessToken: string;
  refreshToken: string;
  onboardingRequired: boolean;
};

export type MeResponse = Omit<AuthResponse, "accessToken" | "refreshToken">;
