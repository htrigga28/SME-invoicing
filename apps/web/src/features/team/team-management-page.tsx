"use client";

import React, { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import {
  DataTable,
  DataTableContainer,
  TableHeaderCell
} from "@/components/ui/data-table";
import { Alert, EmptyState, LoadingSkeleton } from "@/components/ui/feedback";
import { FieldLabel, FormField, Input } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import type { MeResponse } from "@/features/auth/types";

import {
  createTeamInvitation,
  listTeamInvitations,
  listTeamMembers,
  removeTeamMember,
  revokeTeamInvitation,
  updateTeamMember
} from "./team-api";
import type { InviteRole, TeamInvitation, TeamMember, TeamRole } from "./types";
import { validateInvitationForm } from "./validation";

type LoadState = "loading" | "ready" | "error";

const roleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  accountant: "Accountant",
  viewer: "Viewer"
};

const teamRoles = ["owner", "admin"] as const;

export function TeamManagementPage() {
  return (
    <AppShell
      deniedMessage="Owner or Admin access is required for team settings."
      requiredRoles={teamRoles}
    >
      {({ accessToken, me }) => <TeamManagementContent accessToken={accessToken} me={me} />}
    </AppShell>
  );
}

export function TeamManagementContent({
  accessToken,
  me
}: {
  accessToken: string;
  me: MeResponse;
}) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inviteRoles = useMemo<InviteRole[]>(() => {
    if (me.membership.role === "owner") return ["admin", "accountant", "viewer"];
    if (me.membership.role === "admin") return ["accountant", "viewer"];
    return [];
  }, [me.membership.role]);

  useEffect(() => {
    async function load() {
      try {
        const [membersResponse, invitationsResponse] = await Promise.all([
          listTeamMembers(accessToken),
          listTeamInvitations(accessToken)
        ]);

        setMembers(membersResponse.members);
        setInvitations(invitationsResponse.invitations);
        setState("ready");
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load team settings.");
        setState("error");
      }
    }

    void load();
  }, [accessToken]);

  async function refreshTeamData() {
    const [membersResponse, invitationsResponse] = await Promise.all([
      listTeamMembers(accessToken),
      listTeamInvitations(accessToken)
    ]);
    setMembers(membersResponse.members);
    setInvitations(invitationsResponse.invitations);
  }

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setInviteUrl(null);

    const errors = validateInvitationForm({ email, role });

    if (Object.keys(errors).length > 0 || !role) {
      setError(Object.values(errors)[0] ?? "Sign in again to invite a teammate.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await createTeamInvitation(accessToken, { email, role });
      setInviteUrl(response.inviteUrl);
      setSuccess("Invitation created.");
      setEmail("");
      setRole("");
      await refreshTeamData();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Could not create invitation.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRevoke(invitationId: string) {
    setError(null);
    setSuccess(null);

    try {
      await revokeTeamInvitation(accessToken, invitationId);
      setSuccess("Invitation revoked.");
      await refreshTeamData();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Could not revoke invitation.");
    }
  }

  async function handleMemberUpdate(
    member: TeamMember,
    input: { role?: InviteRole; status?: "active" | "suspended" }
  ) {
    setError(null);
    setSuccess(null);

    try {
      await updateTeamMember(accessToken, member.id, input);
      setSuccess("Member updated.");
      await refreshTeamData();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update member.");
    }
  }

  async function handleRemove(member: TeamMember) {
    setError(null);
    setSuccess(null);

    try {
      await removeTeamMember(accessToken, member.id);
      setSuccess("Member removed.");
      await refreshTeamData();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not remove member.");
    }
  }

  if (state === "loading") {
    return (
      <section className="mx-auto w-full max-w-[960px] space-y-4">
        <PageHeader
          description={`Manage members and development invitation links for ${me.activeOrganisation.name}.`}
          eyebrow="Settings"
          title="Team"
        />
        <LoadingSkeleton rows={4} />
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className="mx-auto w-full max-w-[960px] space-y-4">
        <PageHeader
          description={`Manage members and development invitation links for ${me.activeOrganisation.name}.`}
          eyebrow="Settings"
          title="Team"
        />
        <Alert tone="error">
          <p>{error ?? "Could not load team settings."}</p>
        </Alert>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-[960px] space-y-4">
      <PageHeader
        description={`Manage members and development invitation links for ${me.activeOrganisation.name}.`}
        eyebrow="Settings"
        title="Team"
      />

      {error ? (
        <Alert tone="error">
          <p>{error}</p>
        </Alert>
      ) : null}
      {success ? (
        <Alert tone="success">
          <p>{success}</p>
        </Alert>
      ) : null}
      {inviteUrl ? (
        <Alert tone="info">
          <p>Development invite URL created. Email delivery is out of scope for this MVP.</p>
          <p className="mt-2 break-all font-mono text-xs">{inviteUrl}</p>
        </Alert>
      ) : null}

      <SectionCard aria-labelledby="team-invite-heading">
        <h2
          className="text-base font-semibold text-[var(--text-primary)]"
          id="team-invite-heading"
        >
          Invite teammate
        </h2>
        <form className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_auto]" onSubmit={handleInvite}>
          <FormField>
            <FieldLabel>Email</FieldLabel>
            <Input
              className="mt-1"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@example.com"
              type="email"
              value={email}
            />
          </FormField>
          <FormField>
            <FieldLabel>Role</FieldLabel>
            <Select
              onChange={(event) => setRole(event.target.value as InviteRole)}
              value={role}
              wrapperClassName="mt-1"
            >
              <option value="">Select role</option>
              {inviteRoles.map((inviteRole) => (
                <option key={inviteRole} value={inviteRole}>
                  {roleLabels[inviteRole]}
                </option>
              ))}
            </Select>
          </FormField>
          <Button className="self-end" isLoading={isSubmitting} loadingLabel="Inviting..." type="submit">
            Invite
          </Button>
        </form>
      </SectionCard>

      <SectionCard aria-labelledby="team-members-heading">
        <h2
          className="text-base font-semibold text-[var(--text-primary)]"
          id="team-members-heading"
        >
          Members
        </h2>
        {members.length === 0 ? (
          <EmptyState
            className="mt-4 border-0 p-6"
            description="Invite a teammate to grow this workspace."
            title="No members found."
          />
        ) : (
          <DataTableContainer className="mt-4">
            <div className="overflow-x-auto">
              <DataTable className="min-w-[640px]">
                <thead>
                  <tr>
                    <TableHeaderCell>Member</TableHeaderCell>
                    <TableHeaderCell>Role</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {members.map((member) => (
                    <MemberRow
                      actorRole={me.membership.role}
                      currentUserId={me.user.id}
                      key={member.id}
                      member={member}
                      onRemove={handleRemove}
                      onUpdate={handleMemberUpdate}
                    />
                  ))}
                </tbody>
              </DataTable>
            </div>
          </DataTableContainer>
        )}
      </SectionCard>

      <SectionCard aria-labelledby="team-invitations-heading">
        <h2
          className="text-base font-semibold text-[var(--text-primary)]"
          id="team-invitations-heading"
        >
          Pending invitations
        </h2>
        {invitations.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">No pending invitations.</p>
        ) : (
          <div className="mt-2 divide-y divide-[var(--border-subtle)]">
            {invitations.map((invitation) => (
              <InvitationRow
                invitation={invitation}
                key={invitation.id}
                onRevoke={handleRevoke}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </section>
  );
}

function MemberRow({
  actorRole,
  currentUserId,
  member,
  onRemove,
  onUpdate
}: {
  actorRole: string;
  currentUserId: string;
  member: TeamMember;
  onRemove: (member: TeamMember) => Promise<void>;
  onUpdate: (
    member: TeamMember,
    input: { role?: InviteRole; status?: "active" | "suspended" }
  ) => Promise<void>;
}) {
  const [role, setRole] = useState<TeamRole>(member.role);
  const [status, setStatus] = useState<"active" | "suspended">(
    member.status === "suspended" ? "suspended" : "active"
  );
  const isSelf = member.userId === currentUserId;
  const canManage =
    !isSelf &&
    member.role !== "owner" &&
    (actorRole === "owner" || (actorRole === "admin" && member.role !== "admin"));
  const roleOptions: TeamRole[] =
    member.role === "owner"
      ? ["owner"]
      : actorRole === "owner"
        ? ["admin", "accountant", "viewer"]
        : ["accountant", "viewer"];

  function handleSave() {
    if (role === "owner") {
      return;
    }

    void onUpdate(member, { role, status });
  }

  return (
    <tr className="transition duration-150 hover:bg-[var(--surface-selected)]">
      <td className="min-w-44 px-4 py-3">
        <p className="font-medium text-[var(--text-primary)]">
          {member.user?.name ?? "Unknown user"}
        </p>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">{member.user?.email}</p>
      </td>
      <td className="min-w-40 px-4 py-3">
        <div className="flex items-center gap-2">
          <Select
            aria-label={`Role for ${member.user?.email ?? member.id}`}
            disabled={!canManage}
            onChange={(event) => setRole(event.target.value as TeamRole)}
            value={role}
          >
            {roleOptions.map((option) => (
              <option key={option} value={option}>
                {roleLabels[option]}
              </option>
            ))}
          </Select>
          {member.role === "owner" ? (
            <StatusBadge status="owner" tone="neutral">
              Owner
            </StatusBadge>
          ) : null}
        </div>
      </td>
      <td className="min-w-36 px-4 py-3">
        <Select
          aria-label={`Status for ${member.user?.email ?? member.id}`}
          disabled={!canManage || member.status === "removed"}
          onChange={(event) => setStatus(event.target.value as "active" | "suspended")}
          value={status}
        >
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </Select>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <div className="inline-flex gap-2">
          <Button disabled={!canManage} onClick={handleSave} size="sm" type="button" variant="outline">
            Save
          </Button>
          <Button
            disabled={!canManage}
            onClick={() => void onRemove(member)}
            size="sm"
            type="button"
            variant="destructive"
          >
            Remove
          </Button>
        </div>
      </td>
    </tr>
  );
}

function InvitationRow({
  invitation,
  onRevoke
}: {
  invitation: TeamInvitation;
  onRevoke: (invitationId: string) => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-3 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-medium text-[var(--text-primary)]">{invitation.email}</p>
        <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
          {roleLabels[invitation.role]} · Expires{" "}
          {new Date(invitation.expiresAt).toLocaleDateString()}
        </p>
      </div>
      <Button
        className="self-start sm:self-auto"
        onClick={() => void onRevoke(invitation.id)}
        size="sm"
        type="button"
        variant="outline"
      >
        Revoke
      </Button>
    </div>
  );
}
