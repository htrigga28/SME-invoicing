import { apiGet, apiRequest } from "@/lib/api";

import type {
  InvitationAcceptResponse,
  InvitationPreview,
  InviteRole,
  MemberStatus,
  Pagination,
  TeamInvitation,
  TeamMember
} from "./types";

export function listTeamMembers(accessToken: string) {
  return apiGet<{ members: TeamMember[]; pagination: Pagination }>("/team/members", {
    accessToken
  });
}

export function listTeamInvitations(accessToken: string, status = "pending") {
  return apiGet<{ invitations: TeamInvitation[]; pagination: Pagination }>(
    `/team/invitations?status=${encodeURIComponent(status)}`,
    { accessToken }
  );
}

export function createTeamInvitation(
  accessToken: string,
  input: { email: string; role: InviteRole }
) {
  return apiRequest<{ invitation: TeamInvitation; inviteUrl: string }>("/team/invitations", {
    method: "POST",
    accessToken,
    body: input
  });
}

export function revokeTeamInvitation(accessToken: string, invitationId: string) {
  return apiRequest<{ invitation: TeamInvitation }>(`/team/invitations/${invitationId}/revoke`, {
    method: "POST",
    accessToken
  });
}

export function updateTeamMember(
  accessToken: string,
  memberId: string,
  input: { role?: InviteRole; status?: Exclude<MemberStatus, "removed"> }
) {
  return apiRequest<{ member: TeamMember }>(`/team/members/${memberId}`, {
    method: "PATCH",
    accessToken,
    body: input
  });
}

export function removeTeamMember(accessToken: string, memberId: string) {
  return apiRequest<{ member: TeamMember }>(`/team/members/${memberId}/remove`, {
    method: "POST",
    accessToken
  });
}

export function previewInvitation(token: string) {
  return apiGet<InvitationPreview>(`/invitations/${encodeURIComponent(token)}`);
}

export function acceptInvitation(
  token: string,
  input: { mode: "existing" } | { mode: "new"; name: string; password: string },
  accessToken?: string
) {
  const options = {
    method: "POST",
    body: input
  };

  return apiRequest<InvitationAcceptResponse>(`/invitations/${encodeURIComponent(token)}/accept`, {
    ...options,
    ...(accessToken ? { accessToken } : {})
  });
}
