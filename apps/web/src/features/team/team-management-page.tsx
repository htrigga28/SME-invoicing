"use client";

import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import type { MeResponse } from "@/features/auth/types";

import {
  createTeamInvitation,
  listTeamInvitations,
  listTeamMembers,
  removeTeamMember,
  revokeTeamInvitation,
  updateTeamMember
} from "./team-api";
import type { InviteRole, TeamInvitation, TeamMember } from "./types";
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

function TeamManagementContent({ accessToken, me }: { accessToken: string; me: MeResponse }) {
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
    return <StatusPanel message="Loading team settings..." />;
  }

  if (state === "error") {
    return <StatusPanel message={error ?? "Could not load team settings."} tone="error" />;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-teal-700">Settings</p>
          <h1 className="text-3xl font-semibold text-slate-950">Team</h1>
          <p className="mt-2 text-sm text-slate-600">
            Manage members and development invitation links for {me.activeOrganisation.name}.
          </p>
        </div>
      </div>

      {error ? <Alert tone="error" message={error} /> : null}
      {success ? <Alert tone="success" message={success} /> : null}
      {inviteUrl ? (
        <Alert
          tone="info"
          message="Development invite URL created. Email delivery is out of scope for this MVP."
          detail={inviteUrl}
        />
      ) : null}

      <form className="rounded-lg border border-slate-200 bg-white p-5" onSubmit={handleInvite}>
        <h2 className="text-lg font-semibold text-slate-950">Invite teammate</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@example.com"
              type="email"
              value={email}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Role</span>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setRole(event.target.value as InviteRole)}
              value={role}
            >
              <option value="">Select role</option>
              {inviteRoles.map((inviteRole) => (
                <option key={inviteRole} value={inviteRole}>
                  {roleLabels[inviteRole]}
                </option>
              ))}
            </select>
          </label>
          <button
            className="self-end rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Inviting..." : "Invite"}
          </button>
        </div>
      </form>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Members" {...(members.length === 0 ? { empty: "No members found." } : {})}>
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
        </Panel>

        <Panel
          title="Pending invitations"
          {...(invitations.length === 0 ? { empty: "No pending invitations." } : {})}
        >
          {invitations.map((invitation) => (
            <div
              className="flex flex-col gap-3 border-b border-slate-100 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between"
              key={invitation.id}
            >
              <div>
                <p className="font-medium text-slate-950">{invitation.email}</p>
                <p className="text-sm text-slate-600">
                  {roleLabels[invitation.role]} · Expires{" "}
                  {new Date(invitation.expiresAt).toLocaleDateString()}
                </p>
              </div>
              <button
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                onClick={() => void handleRevoke(invitation.id)}
                type="button"
              >
                Revoke
              </button>
            </div>
          ))}
        </Panel>
      </div>
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
  const [role, setRole] = useState<InviteRole>(member.role === "owner" ? "viewer" : member.role);
  const [status, setStatus] = useState<"active" | "suspended">(
    member.status === "suspended" ? "suspended" : "active"
  );
  const isSelf = member.userId === currentUserId;
  const canManage =
    !isSelf &&
    member.role !== "owner" &&
    (actorRole === "owner" || (actorRole === "admin" && member.role !== "admin"));
  const roleOptions: InviteRole[] =
    actorRole === "owner" ? ["admin", "accountant", "viewer"] : ["accountant", "viewer"];

  return (
    <div className="border-b border-slate-100 py-4 last:border-0">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-medium text-slate-950">{member.user?.name ?? "Unknown user"}</p>
          <p className="text-sm text-slate-600">
            {member.user?.email} · {roleLabels[member.role]} · {member.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            disabled={!canManage}
            onChange={(event) => setRole(event.target.value as InviteRole)}
            value={role}
          >
            {roleOptions.map((option) => (
              <option key={option} value={option}>
                {roleLabels[option]}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            disabled={!canManage || member.status === "removed"}
            onChange={(event) => setStatus(event.target.value as "active" | "suspended")}
            value={status}
          >
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
            disabled={!canManage}
            onClick={() => void onUpdate(member, { role, status })}
            type="button"
          >
            Save
          </button>
          <button
            className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 disabled:cursor-not-allowed disabled:text-slate-400"
            disabled={!canManage}
            onClick={() => void onRemove(member)}
            type="button"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function Panel({
  children,
  empty,
  title
}: {
  children: React.ReactNode;
  empty?: string;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <div className="mt-2">
        {empty ? <p className="py-8 text-sm text-slate-600">{empty}</p> : children}
      </div>
    </div>
  );
}

function Alert({
  detail,
  message,
  tone
}: {
  detail?: string;
  message: string;
  tone: "error" | "info" | "success";
}) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-700",
    info: "border-blue-200 bg-blue-50 text-blue-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800"
  };

  return (
    <div className={`rounded-lg border p-4 text-sm ${styles[tone]}`}>
      <p>{message}</p>
      {detail ? <p className="mt-2 break-all font-mono text-xs">{detail}</p> : null}
    </div>
  );
}

function StatusPanel({
  detail,
  message,
  tone = "info"
}: {
  detail?: string;
  message: string;
  tone?: "error" | "info" | "warning";
}) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-700",
    info: "border-slate-200 bg-white text-slate-600",
    warning: "border-amber-200 bg-amber-50 text-amber-800"
  };

  return (
    <section className={`rounded-lg border p-6 text-sm ${styles[tone]}`}>
      <p>{message}</p>
      {detail ? <p className="mt-2">{detail}</p> : null}
    </section>
  );
}
