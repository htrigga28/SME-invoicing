import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, isNull } from "drizzle-orm";

import { DatabaseService } from "../../database/database.service";
import {
  auditLogs,
  businessProfiles,
  organisations,
  organisationMembers,
  refreshTokens,
  users,
  type BusinessProfile,
  type Organisation,
  type RefreshToken,
  type User
} from "../../database/schema";
import type { ActiveOrganisationContext, SafeUser } from "../../common/types/request-context";

type RegisterInput = {
  email: string;
  passwordHash: string;
  name: string;
  organisationName: string;
  organisationSlug: string;
  refreshTokenHash: string;
  refreshTokenExpiresAt: Date;
};

type AuditLogInput = {
  organisationId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadataRedacted?: Record<string, unknown> | null;
};

type RegistrationRecord = ActiveOrganisationContext & {
  refreshToken: RefreshToken;
};

@Injectable()
export class AuthRepository {
  constructor(@Inject(DatabaseService) private readonly databaseService: DatabaseService) {}

  async findUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await this.databaseService.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user;
  }

  async findUserById(userId: string): Promise<User | undefined> {
    const [user] = await this.databaseService.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user;
  }

  async register(input: RegisterInput): Promise<RegistrationRecord> {
    return this.databaseService.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: input.email,
          passwordHash: input.passwordHash,
          name: input.name
        })
        .returning();

      if (!user) {
        throw new Error("User creation failed.");
      }

      const [organisation] = await tx
        .insert(organisations)
        .values({
          name: input.organisationName,
          slug: input.organisationSlug
        })
        .returning();

      if (!organisation) {
        throw new Error("Organisation creation failed.");
      }

      const [membership] = await tx
        .insert(organisationMembers)
        .values({
          organisationId: organisation.id,
          userId: user.id,
          role: "owner",
          status: "active"
        })
        .returning();

      const [businessProfile] = await tx
        .insert(businessProfiles)
        .values({
          organisationId: organisation.id
        })
        .returning();

      const [refreshToken] = await tx
        .insert(refreshTokens)
        .values({
          userId: user.id,
          tokenHash: input.refreshTokenHash,
          expiresAt: input.refreshTokenExpiresAt
        })
        .returning();

      if (!membership || !businessProfile || !refreshToken) {
        throw new Error("Registration transaction failed.");
      }

      await tx.insert(auditLogs).values({
        organisationId: organisation.id,
        actorUserId: user.id,
        action: "user_registered",
        entityType: "user",
        entityId: user.id,
        metadataRedacted: { organisationId: organisation.id }
      });

      return {
        user: this.toSafeUser(user),
        activeOrganisation: organisation,
        membership,
        businessProfile,
        refreshToken
      };
    });
  }

  async getActiveContextForUser(userId: string): Promise<ActiveOrganisationContext | undefined> {
    const user = await this.findUserById(userId);

    if (!user) {
      return undefined;
    }

    const [membership] = await this.databaseService.db
      .select()
      .from(organisationMembers)
      .where(and(eq(organisationMembers.userId, userId), eq(organisationMembers.status, "active")))
      .orderBy(asc(organisationMembers.createdAt))
      .limit(1);

    if (!membership) {
      return undefined;
    }

    const [organisation] = await this.databaseService.db
      .select()
      .from(organisations)
      .where(eq(organisations.id, membership.organisationId))
      .limit(1);

    const [businessProfile] = await this.databaseService.db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.organisationId, membership.organisationId))
      .limit(1);

    if (!organisation || !businessProfile) {
      return undefined;
    }

    return {
      user: this.toSafeUser(user),
      activeOrganisation: organisation,
      membership,
      businessProfile
    };
  }

  async createRefreshToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date
  ): Promise<RefreshToken> {
    const [refreshToken] = await this.databaseService.db
      .insert(refreshTokens)
      .values({ userId, tokenHash, expiresAt })
      .returning();

    if (!refreshToken) {
      throw new Error("Refresh token creation failed.");
    }

    return refreshToken;
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | undefined> {
    const [refreshToken] = await this.databaseService.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);
    return refreshToken;
  }

  async revokeRefreshToken(refreshTokenId: string): Promise<void> {
    await this.databaseService.db
      .update(refreshTokens)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(refreshTokens.id, refreshTokenId));
  }

  async rotateRefreshToken(
    oldRefreshTokenId: string,
    userId: string,
    newTokenHash: string,
    newTokenExpiresAt: Date
  ): Promise<void> {
    await this.databaseService.db.transaction(async (tx) => {
      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(refreshTokens.id, oldRefreshTokenId), isNull(refreshTokens.revokedAt)));

      await tx.insert(refreshTokens).values({
        userId,
        tokenHash: newTokenHash,
        expiresAt: newTokenExpiresAt
      });
    });
  }

  async updateBusinessProfile(
    organisationId: string,
    input: {
      businessName: string;
      email: string;
      phone: string;
      address: string;
      logoFileId?: string | null;
      setupCompletedAt?: Date;
    }
  ): Promise<BusinessProfile> {
    const [businessProfile] = await this.databaseService.db
      .update(businessProfiles)
      .set({
        businessName: input.businessName,
        email: input.email,
        phone: input.phone,
        address: input.address,
        logoFileId: input.logoFileId ?? null,
        setupCompletedAt: input.setupCompletedAt,
        updatedAt: new Date()
      })
      .where(eq(businessProfiles.organisationId, organisationId))
      .returning();

    if (!businessProfile) {
      throw new Error("Business profile was not found.");
    }

    return businessProfile;
  }

  async completeOrganisationOnboarding(organisationId: string): Promise<Organisation> {
    const [organisation] = await this.databaseService.db
      .update(organisations)
      .set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
      .where(eq(organisations.id, organisationId))
      .returning();

    if (!organisation) {
      throw new Error("Organisation was not found.");
    }

    return organisation;
  }

  async createAuditLog(input: AuditLogInput): Promise<void> {
    await this.databaseService.db.insert(auditLogs).values({
      organisationId: input.organisationId ?? null,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadataRedacted: input.metadataRedacted ?? null
    });
  }

  toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
}
