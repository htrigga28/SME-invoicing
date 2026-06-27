import type {
  BusinessProfile,
  Organisation,
  OrganisationMember,
  User
} from "../../database/schema";

export type AuthenticatedUser = {
  userId: string;
};

export type ActiveOrganisationContext = {
  user: SafeUser;
  activeOrganisation: Organisation;
  membership: OrganisationMember;
  businessProfile: BusinessProfile;
};

export type SafeUser = Pick<User, "id" | "email" | "name" | "createdAt" | "updatedAt">;

export type AuthenticatedRequest = {
  headers: {
    authorization?: string;
  };
  authUser?: AuthenticatedUser;
  tenant?: ActiveOrganisationContext;
};

export type RoleRequirement = "owner" | "admin" | "accountant" | "viewer";
