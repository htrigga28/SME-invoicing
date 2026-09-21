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

export type OnboardingStep = "business_profile" | "payment_setup" | null;

export type AuthResponse = {
  user: SafeUser;
  activeOrganisation: Organisation;
  membership: Membership;
  businessProfile: BusinessProfile;
  accessToken: string;
  onboardingRequired: boolean;
  onboardingStep: OnboardingStep;
  selectionRequired: false;
};

export type WorkspaceSelectionResponse = {
  user: SafeUser;
  selectionRequired: true;
  organisations: OrganisationMembership[];
  accessToken: string;
};

export type LoginResponse = AuthResponse | WorkspaceSelectionResponse;

export type MeResponse = Omit<AuthResponse, "accessToken">;

export type OrganisationMembership = {
  organisation: Organisation;
  membership: Membership;
};

export type OrganisationsResponse = {
  organisations: OrganisationMembership[];
  activeOrganisationId: string | null;
};
