import { ForbiddenException } from "@nestjs/common";

export type InviteableRole = "admin" | "accountant" | "viewer";
export type TeamRole = "owner" | InviteableRole;

export function assertInvitePermission(actorRole: TeamRole, inviteRole: InviteableRole) {
  if (actorRole === "owner") {
    return;
  }

  if (actorRole === "admin" && inviteRole !== "admin") {
    return;
  }

  throw new ForbiddenException("Your role cannot create this invitation.");
}

export function assertMemberManagementPermission(input: {
  actorRole: TeamRole;
  actorUserId: string;
  targetRole: TeamRole;
  targetUserId: string;
  requestedRole?: InviteableRole;
}) {
  if (input.targetUserId === input.actorUserId) {
    throw new ForbiddenException("You cannot modify your own team access.");
  }

  if (input.targetRole === "owner") {
    throw new ForbiddenException("Owner membership cannot be changed in this MVP.");
  }

  if (input.actorRole === "admin" && input.requestedRole === "admin") {
    throw new ForbiddenException("Admins cannot promote users to Admin.");
  }

  if (input.actorRole === "admin" && input.targetRole === "admin") {
    throw new ForbiddenException("Admins cannot manage Admin members.");
  }
}
