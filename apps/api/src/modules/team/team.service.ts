import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, asc, count, desc, eq } from "drizzle-orm";

import type { ActiveOrganisationContext } from "../../common/types/request-context";
import { DatabaseService } from "../../database/database.service";
import {
  auditLogs,
  businessProfiles,
  organisationInvitations,
  organisationMembers,
  organisations,
  refreshTokens,
  users,
  type OrganisationInvitation,
  type OrganisationMember,
  type User
} from "../../database/schema";
import { AuthRepository } from "../auth/auth.repository";
import { PasswordService } from "../auth/password.service";
import { TokenService } from "../auth/token.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { AcceptInvitationDto } from "./dto/accept-invitation.dto";
import { CreateInvitationDto } from "./dto/create-invitation.dto";
import { ListInvitationsQueryDto } from "./dto/list-invitations-query.dto";
import { ListMembersQueryDto } from "./dto/list-members-query.dto";
import { UpdateMemberDto } from "./dto/update-member.dto";
import {
  assertInvitePermission,
  assertMemberManagementPermission,
  type InviteableRole,
  type TeamRole
} from "./team-policy";

type MemberStatus = "active" | "suspended" | "removed";

type PaginationInput = {
  page?: number;
  limit?: number;
};

@Injectable()
export class TeamService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
    @Inject(AuthRepository) private readonly authRepository: AuthRepository,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(TokenService) private readonly tokenService: TokenService,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService,
    @Inject(ConfigService) private readonly configService: ConfigService
  ) {}

  async createInvitation(context: ActiveOrganisationContext, input: CreateInvitationDto) {
    assertInvitePermission(context.membership.role as TeamRole, input.role);

    const email = this.normalizeEmail(input.email);
    const existingUser = await this.authRepository.findUserByEmail(email);

    if (existingUser) {
      const existingMember = await this.findMemberByUserId(
        context.activeOrganisation.id,
        existingUser.id
      );

      if (existingMember?.status === "active") {
        throw new ConflictException("This user is already an active member.");
      }
    }

    const pendingInvite = await this.findPendingInvitationByEmail(
      context.activeOrganisation.id,
      email
    );

    if (pendingInvite) {
      throw new ConflictException("A pending invitation already exists for this email.");
    }

    const rawToken = this.tokenService.generateInvitationToken();
    const tokenHash = this.tokenService.hashInvitationToken(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    const [invitation] = await this.databaseService.db
      .insert(organisationInvitations)
      .values({
        organisationId: context.activeOrganisation.id,
        email,
        tokenHash,
        role: input.role,
        status: "pending",
        invitedByUserId: context.user.id,
        expiresAt
      })
      .returning();

    if (!invitation) {
      throw new Error("Invitation creation failed.");
    }

    await this.auditLogService.create({
      organisationId: context.activeOrganisation.id,
      actorUserId: context.user.id,
      action: "team_invitation_created",
      entityType: "organisation_invitation",
      entityId: invitation.id,
      metadataRedacted: { email, role: input.role }
    });

    return {
      invitation: this.toSafeInvitation(invitation),
      inviteUrl: this.createInviteUrl(rawToken)
    };
  }

  async listInvitations(context: ActiveOrganisationContext, query: ListInvitationsQueryDto) {
    const pagination = this.getPagination(query);
    const conditions = [eq(organisationInvitations.organisationId, context.activeOrganisation.id)];

    if (query.status) {
      conditions.push(eq(organisationInvitations.status, query.status));
    }

    const rows = await this.databaseService.db
      .select({
        invitation: organisationInvitations,
        inviter: {
          id: users.id,
          name: users.name,
          email: users.email
        }
      })
      .from(organisationInvitations)
      .leftJoin(users, eq(users.id, organisationInvitations.invitedByUserId))
      .where(and(...conditions))
      .orderBy(desc(organisationInvitations.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset);

    const [countRow] = await this.databaseService.db
      .select({ total: count() })
      .from(organisationInvitations)
      .where(and(...conditions));

    return {
      invitations: rows.map((row) => ({
        ...this.toSafeInvitation(row.invitation),
        invitedBy: row.inviter
      })),
      pagination: this.toPaginationResponse(pagination, countRow?.total ?? 0)
    };
  }

  async revokeInvitation(context: ActiveOrganisationContext, invitationId: string) {
    const invitation = await this.findInvitationInOrganisation(
      context.activeOrganisation.id,
      invitationId
    );

    if (!invitation) {
      throw new NotFoundException("Invitation was not found.");
    }

    if (invitation.status !== "pending") {
      throw new UnprocessableEntityException("Only pending invitations can be revoked.");
    }

    if (context.membership.role === "admin" && invitation.role === "admin") {
      throw new ForbiddenException("Admins cannot revoke Admin invitations.");
    }

    const [updated] = await this.databaseService.db
      .update(organisationInvitations)
      .set({ status: "revoked", revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(organisationInvitations.id, invitationId))
      .returning();

    if (!updated) {
      throw new Error("Invitation revocation failed.");
    }

    await this.auditLogService.create({
      organisationId: context.activeOrganisation.id,
      actorUserId: context.user.id,
      action: "team_invitation_revoked",
      entityType: "organisation_invitation",
      entityId: invitation.id,
      metadataRedacted: { email: invitation.email, role: invitation.role }
    });

    return { invitation: this.toSafeInvitation(updated) };
  }

  async previewInvitation(rawToken: string) {
    const invitation = await this.findPendingInvitationByRawToken(rawToken);
    const validInvitation = await this.assertInvitationUsable(invitation);

    const [organisation] = await this.databaseService.db
      .select()
      .from(organisations)
      .where(eq(organisations.id, validInvitation.organisationId))
      .limit(1);

    if (!organisation) {
      throw new NotFoundException("Invitation is not valid.");
    }

    return {
      invitation: {
        organisationName: organisation.name,
        email: validInvitation.email,
        role: validInvitation.role,
        expiresAt: validInvitation.expiresAt
      }
    };
  }

  async acceptInvitation(
    rawToken: string,
    input: AcceptInvitationDto,
    authenticatedUserId?: string
  ) {
    const invitation = await this.findPendingInvitationByRawToken(rawToken);
    const validInvitation = await this.assertInvitationUsable(invitation);
    const now = new Date();

    if (input.mode === "existing") {
      if (!authenticatedUserId) {
        throw new UnauthorizedException("Login is required to accept as an existing user.");
      }

      const user = await this.authRepository.findUserById(authenticatedUserId);

      if (!user) {
        throw new UnauthorizedException("Authenticated user was not found.");
      }

      if (this.normalizeEmail(user.email) !== validInvitation.email) {
        throw new ForbiddenException("Login with the invited email address to accept this invite.");
      }

      return this.acceptForUser(validInvitation, user, now);
    }

    const existingUser = await this.authRepository.findUserByEmail(validInvitation.email);

    if (existingUser) {
      throw new ConflictException(
        "An account already exists. Login and accept as an existing user."
      );
    }

    if (!input.name || !input.password) {
      throw new BadRequestException("Name and password are required for new invited users.");
    }

    const passwordHash = await this.passwordService.hash(input.password);

    return this.acceptForNewUser(validInvitation, input.name, passwordHash, now);
  }

  async listMembers(context: ActiveOrganisationContext, query: ListMembersQueryDto) {
    const pagination = this.getPagination(query);
    const conditions = [eq(organisationMembers.organisationId, context.activeOrganisation.id)];

    if (query.status) {
      conditions.push(eq(organisationMembers.status, query.status));
    }

    const rows = await this.databaseService.db
      .select({
        member: organisationMembers,
        user: {
          id: users.id,
          name: users.name,
          email: users.email
        }
      })
      .from(organisationMembers)
      .innerJoin(users, eq(users.id, organisationMembers.userId))
      .where(and(...conditions))
      .orderBy(asc(organisationMembers.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset);

    const [countRow] = await this.databaseService.db
      .select({ total: count() })
      .from(organisationMembers)
      .where(and(...conditions));

    return {
      members: rows.map((row) => this.toSafeMember(row.member, row.user)),
      pagination: this.toPaginationResponse(pagination, countRow?.total ?? 0)
    };
  }

  async updateMember(
    context: ActiveOrganisationContext,
    membershipId: string,
    input: UpdateMemberDto
  ) {
    if (!input.role && !input.status) {
      throw new BadRequestException("Provide a role or status to update.");
    }

    const member = await this.findMemberById(context.activeOrganisation.id, membershipId);

    if (!member) {
      throw new NotFoundException("Member was not found.");
    }

    this.assertCanManageMember(context, member, input.role);

    if (member.status === "removed") {
      throw new UnprocessableEntityException("Removed members cannot be reactivated here.");
    }

    const [updated] = await this.databaseService.db
      .update(organisationMembers)
      .set({
        role: input.role ?? member.role,
        status: input.status ?? member.status,
        updatedAt: new Date()
      })
      .where(eq(organisationMembers.id, member.id))
      .returning();

    if (!updated) {
      throw new Error("Member update failed.");
    }

    await this.auditLogService.create({
      organisationId: context.activeOrganisation.id,
      actorUserId: context.user.id,
      action: "team_member_updated",
      entityType: "organisation_member",
      entityId: member.id,
      metadataRedacted: { role: updated.role, status: updated.status }
    });

    const user = await this.authRepository.findUserById(updated.userId);
    return { member: this.toSafeMember(updated, user) };
  }

  async removeMember(context: ActiveOrganisationContext, membershipId: string) {
    const member = await this.findMemberById(context.activeOrganisation.id, membershipId);

    if (!member) {
      throw new NotFoundException("Member was not found.");
    }

    this.assertCanManageMember(context, member);

    const [updated] = await this.databaseService.db
      .update(organisationMembers)
      .set({ status: "removed", updatedAt: new Date() })
      .where(eq(organisationMembers.id, member.id))
      .returning();

    if (!updated) {
      throw new Error("Member removal failed.");
    }

    await this.auditLogService.create({
      organisationId: context.activeOrganisation.id,
      actorUserId: context.user.id,
      action: "team_member_removed",
      entityType: "organisation_member",
      entityId: member.id,
      metadataRedacted: { previousRole: member.role }
    });

    const user = await this.authRepository.findUserById(updated.userId);
    return { member: this.toSafeMember(updated, user) };
  }

  private async acceptForUser(invitation: OrganisationInvitation, user: User, acceptedAt: Date) {
    const existingMember = await this.findMemberByUserId(invitation.organisationId, user.id);

    if (existingMember?.status === "active") {
      throw new ConflictException("This user is already an active organisation member.");
    }

    if (existingMember) {
      throw new ConflictException(
        "This user already has a membership record for this organisation."
      );
    }

    const rawRefreshToken = this.tokenService.generateRefreshToken();
    const refreshTokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
    const refreshTokenExpiresAt = this.tokenService.getRefreshTokenExpiry();

    return this.databaseService.db.transaction(async (tx) => {
      const [membership] = await tx
        .insert(organisationMembers)
        .values({
          organisationId: invitation.organisationId,
          userId: user.id,
          role: invitation.role,
          status: "active"
        })
        .returning();

      if (!membership) {
        throw new Error("Membership creation failed.");
      }

      const [updatedInvitation] = await tx
        .update(organisationInvitations)
        .set({ status: "accepted", acceptedAt, updatedAt: acceptedAt })
        .where(
          and(
            eq(organisationInvitations.id, invitation.id),
            eq(organisationInvitations.status, "pending")
          )
        )
        .returning();

      if (!updatedInvitation) {
        throw new ConflictException("Invitation was already used.");
      }

      await tx.insert(refreshTokens).values({
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: refreshTokenExpiresAt
      });

      await tx.insert(auditLogs).values({
        organisationId: invitation.organisationId,
        actorUserId: user.id,
        action: "team_invitation_accepted",
        entityType: "organisation_invitation",
        entityId: invitation.id,
        metadataRedacted: { email: invitation.email, role: invitation.role }
      });

      const [organisation] = await tx
        .select()
        .from(organisations)
        .where(eq(organisations.id, invitation.organisationId))
        .limit(1);

      const [businessProfile] = await tx
        .select()
        .from(businessProfiles)
        .where(eq(businessProfiles.organisationId, invitation.organisationId))
        .limit(1);

      if (!organisation || !businessProfile) {
        throw new Error("Invitation organisation context was not found.");
      }

      return {
        user: this.authRepository.toSafeUser(user),
        organisation,
        membership,
        accessToken: this.tokenService.signAccessToken(user.id),
        refreshToken: rawRefreshToken,
        onboardingRequired:
          businessProfile.setupCompletedAt === null || organisation.onboardingCompletedAt === null
      };
    });
  }

  private async acceptForNewUser(
    invitation: OrganisationInvitation,
    name: string,
    passwordHash: string,
    acceptedAt: Date
  ) {
    const rawRefreshToken = this.tokenService.generateRefreshToken();
    const refreshTokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
    const refreshTokenExpiresAt = this.tokenService.getRefreshTokenExpiry();

    return this.databaseService.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: invitation.email,
          name: name.trim(),
          passwordHash
        })
        .returning();

      if (!user) {
        throw new Error("Invited user creation failed.");
      }

      const [membership] = await tx
        .insert(organisationMembers)
        .values({
          organisationId: invitation.organisationId,
          userId: user.id,
          role: invitation.role,
          status: "active"
        })
        .returning();

      if (!membership) {
        throw new Error("Membership creation failed.");
      }

      const [updatedInvitation] = await tx
        .update(organisationInvitations)
        .set({ status: "accepted", acceptedAt, updatedAt: acceptedAt })
        .where(
          and(
            eq(organisationInvitations.id, invitation.id),
            eq(organisationInvitations.status, "pending")
          )
        )
        .returning();

      if (!updatedInvitation) {
        throw new ConflictException("Invitation was already used.");
      }

      await tx.insert(refreshTokens).values({
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: refreshTokenExpiresAt
      });

      await tx.insert(auditLogs).values({
        organisationId: invitation.organisationId,
        actorUserId: user.id,
        action: "team_invitation_accepted",
        entityType: "organisation_invitation",
        entityId: invitation.id,
        metadataRedacted: { email: invitation.email, role: invitation.role }
      });

      const [organisation] = await tx
        .select()
        .from(organisations)
        .where(eq(organisations.id, invitation.organisationId))
        .limit(1);

      const [businessProfile] = await tx
        .select()
        .from(businessProfiles)
        .where(eq(businessProfiles.organisationId, invitation.organisationId))
        .limit(1);

      if (!organisation || !businessProfile) {
        throw new Error("Invitation organisation context was not found.");
      }

      return {
        user: this.authRepository.toSafeUser(user),
        organisation,
        membership,
        accessToken: this.tokenService.signAccessToken(user.id),
        refreshToken: rawRefreshToken,
        onboardingRequired:
          businessProfile.setupCompletedAt === null || organisation.onboardingCompletedAt === null
      };
    });
  }

  private async assertInvitationUsable(invitation: OrganisationInvitation | undefined) {
    if (!invitation) {
      throw new NotFoundException("Invitation is not valid.");
    }

    if (invitation.status !== "pending") {
      throw new UnprocessableEntityException("Invitation is no longer pending.");
    }

    if (invitation.expiresAt <= new Date()) {
      await this.databaseService.db
        .update(organisationInvitations)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(organisationInvitations.id, invitation.id));

      throw new UnprocessableEntityException("Invitation has expired.");
    }

    return invitation;
  }

  private assertCanManageMember(
    context: ActiveOrganisationContext,
    target: OrganisationMember,
    requestedRole?: InviteableRole
  ) {
    assertMemberManagementPermission({
      actorRole: context.membership.role as TeamRole,
      actorUserId: context.user.id,
      targetRole: target.role as TeamRole,
      targetUserId: target.userId,
      ...(requestedRole ? { requestedRole } : {})
    });
  }

  private async findMemberById(organisationId: string, membershipId: string) {
    const [member] = await this.databaseService.db
      .select()
      .from(organisationMembers)
      .where(
        and(
          eq(organisationMembers.organisationId, organisationId),
          eq(organisationMembers.id, membershipId)
        )
      )
      .limit(1);

    return member;
  }

  private async findMemberByUserId(organisationId: string, userId: string) {
    const [member] = await this.databaseService.db
      .select()
      .from(organisationMembers)
      .where(
        and(
          eq(organisationMembers.organisationId, organisationId),
          eq(organisationMembers.userId, userId)
        )
      )
      .limit(1);

    return member;
  }

  private async findInvitationInOrganisation(organisationId: string, invitationId: string) {
    const [invitation] = await this.databaseService.db
      .select()
      .from(organisationInvitations)
      .where(
        and(
          eq(organisationInvitations.organisationId, organisationId),
          eq(organisationInvitations.id, invitationId)
        )
      )
      .limit(1);

    return invitation;
  }

  private async findPendingInvitationByEmail(organisationId: string, email: string) {
    const [invitation] = await this.databaseService.db
      .select()
      .from(organisationInvitations)
      .where(
        and(
          eq(organisationInvitations.organisationId, organisationId),
          eq(organisationInvitations.email, email),
          eq(organisationInvitations.status, "pending")
        )
      )
      .limit(1);

    return invitation;
  }

  private async findPendingInvitationByRawToken(rawToken: string) {
    const tokenHash = this.tokenService.hashInvitationToken(rawToken);
    const [invitation] = await this.databaseService.db
      .select()
      .from(organisationInvitations)
      .where(eq(organisationInvitations.tokenHash, tokenHash))
      .limit(1);

    return invitation;
  }

  private createInviteUrl(rawToken: string) {
    const frontendUrl =
      this.configService.get<string>("FRONTEND_APP_URL") ?? "http://localhost:3000";
    return `${frontendUrl.replace(/\/$/, "")}/accept-invite/${rawToken}`;
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private getPagination(input: PaginationInput) {
    const page = input.page ?? 1;
    const limit = Math.min(input.limit ?? 20, 100);
    return { page, limit, offset: (page - 1) * limit };
  }

  private toPaginationResponse(
    pagination: { page: number; limit: number; offset: number },
    total: number
  ) {
    return {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit))
    };
  }

  private toSafeInvitation(invitation: OrganisationInvitation) {
    const { tokenHash: _tokenHash, ...safeInvitation } = invitation;
    return safeInvitation;
  }

  private toSafeMember(member: OrganisationMember, user?: Pick<User, "id" | "name" | "email">) {
    return {
      id: member.id,
      organisationId: member.organisationId,
      userId: member.userId,
      role: member.role,
      status: member.status as MemberStatus,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
      user: user
        ? {
            id: user.id,
            name: user.name,
            email: user.email
          }
        : null
    };
  }
}
