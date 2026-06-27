import type { Membership, Organisation, SafeUser } from "@/features/auth/types";

export type TeamRole = "owner" | "admin" | "accountant" | "viewer";
export type InviteRole = "admin" | "accountant" | "viewer";
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";
export type MemberStatus = "active" | "suspended" | "removed";

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type TeamInvitation = {
  id: string;
  organisationId: string;
  email: string;
  role: InviteRole;
  status: InvitationStatus;
  invitedByUserId: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  invitedBy?: Pick<SafeUser, "id" | "name" | "email"> | null;
};

export type TeamMember = {
  id: string;
  organisationId: string;
  userId: string;
  role: TeamRole;
  status: MemberStatus;
  createdAt: string;
  updatedAt: string;
  user: Pick<SafeUser, "id" | "name" | "email"> | null;
};

export type InvitationPreview = {
  invitation: {
    organisationName: string;
    email: string;
    role: InviteRole;
    expiresAt: string;
  };
};

export type InvitationAcceptResponse = {
  user: SafeUser;
  organisation: Organisation;
  membership: Membership;
  accessToken: string;
  refreshToken: string;
  onboardingRequired: boolean;
};
