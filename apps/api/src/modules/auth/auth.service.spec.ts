import { ConflictException, ForbiddenException, UnauthorizedException } from "@nestjs/common";

import type { ActiveOrganisationContext } from "../../common/types/request-context";
import { AuthService } from "./auth.service";
import type { AuthRepository } from "./auth.repository";
import type { PasswordService } from "./password.service";
import type { TokenService } from "./token.service";
import type { TenantContextService } from "../tenant/tenant-context.service";

const now = new Date("2026-01-01T00:00:00.000Z");

function createContext(
  overrides: Partial<ActiveOrganisationContext> = {}
): ActiveOrganisationContext {
  return {
    user: {
      id: "user-1",
      email: "owner@example.com",
      name: "Owner User",
      createdAt: now,
      updatedAt: now
    },
    activeOrganisation: {
      id: "org-1",
      name: "Owner User's Workspace",
      slug: "owner-user",
      onboardingCompletedAt: null,
      createdAt: now,
      updatedAt: now
    },
    membership: {
      id: "member-1",
      organisationId: "org-1",
      userId: "user-1",
      role: "owner",
      status: "active",
      createdAt: now,
      updatedAt: now
    },
    businessProfile: {
      id: "profile-1",
      organisationId: "org-1",
      businessName: null,
      email: null,
      phone: null,
      address: null,
      logoFileId: null,
      setupCompletedAt: null,
      createdAt: now,
      updatedAt: now
    },
    ...overrides
  };
}

describe("AuthService", () => {
  function setup() {
    const context = createContext();
    const refreshRecords = new Map<
      string,
      { id: string; userId: string; revokedAt: Date | null; expiresAt: Date }
    >([
      [
        "hash-refresh-token",
        { id: "refresh-1", userId: "user-1", revokedAt: null, expiresAt: new Date("2099-01-01") }
      ]
    ]);
    const repository = {
      findUserByEmail: jest.fn(),
      register: jest.fn().mockResolvedValue({
        ...context,
        refreshToken: {
          id: "refresh-1",
          userId: "user-1",
          tokenHash: "hash-refresh-token",
          expiresAt: new Date("2099-01-01"),
          revokedAt: null,
          createdAt: now,
          updatedAt: now
        }
      }),
      getActiveContextForUser: jest.fn().mockResolvedValue(context),
      hasPaymentAccountHistory: jest.fn().mockResolvedValue(false),
      createRefreshToken: jest.fn(),
      findRefreshTokenByHash: jest.fn((hash: string) => Promise.resolve(refreshRecords.get(hash))),
      rotateRefreshToken: jest.fn(
        async (oldTokenId: string, userId: string, newHash: string, expiresAt: Date) => {
          refreshRecords.set("hash-refresh-token", {
            id: oldTokenId,
            userId,
            revokedAt: new Date(),
            expiresAt
          });
          refreshRecords.set(newHash, { id: "refresh-2", userId, revokedAt: null, expiresAt });
        }
      ),
      revokeRefreshToken: jest.fn(async (refreshTokenId: string) => {
        refreshRecords.set("hash-refresh-token", {
          id: refreshTokenId,
          userId: "user-1",
          revokedAt: new Date(),
          expiresAt: new Date("2099-01-01")
        });
      }),
      listContextsForUser: jest.fn().mockResolvedValue([context]),
      createAuditLog: jest.fn().mockResolvedValue(undefined)
    };
    const passwordService = {
      hash: jest.fn().mockResolvedValue("hashed-password"),
      verify: jest.fn().mockResolvedValue(true)
    };
    const tokenService = {
      generateRefreshToken: jest.fn().mockReturnValue("refresh-token"),
      hashRefreshToken: jest.fn((token: string) => `hash-${token}`),
      getRefreshTokenExpiry: jest.fn().mockReturnValue(new Date("2099-01-01")),
      signAccessToken: jest.fn((userId: string) => `access-${userId}`)
    };
    const tenantContextService = {
      resolveForUser: jest.fn().mockResolvedValue(context)
    };
    const service = new AuthService(
      repository as unknown as AuthRepository,
      passwordService as unknown as PasswordService,
      tokenService as unknown as TokenService,
      tenantContextService as unknown as TenantContextService
    );

    return { context, passwordService, repository, service, tenantContextService, tokenService };
  }

  it("registers a user with organisation, owner membership, blank business profile, refresh token, and audit log", async () => {
    const { repository, service } = setup();
    repository.findUserByEmail.mockResolvedValue(undefined);

    const result = await service.register({
      name: "Owner User",
      email: "OWNER@Example.COM",
      password: "password123"
    });

    expect(repository.register).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "owner@example.com",
        passwordHash: "hashed-password",
        name: "Owner User",
        organisationName: "Owner User's Workspace"
      })
    );
    expect(result.user.email).toBe("owner@example.com");
    expect(result.membership.role).toBe("owner");
    expect(result.businessProfile.setupCompletedAt).toBeNull();
    expect(result.refreshToken).toBe("refresh-token");
    expect(result.onboardingRequired).toBe(true);
    expect(result.onboardingStep).toBe("business_profile");
  });

  it("rejects duplicate registration email", async () => {
    const { context, repository, service } = setup();
    repository.findUserByEmail.mockResolvedValue({
      ...context.user,
      passwordHash: "hashed-password"
    });

    await expect(
      service.register({ name: "Owner User", email: "owner@example.com", password: "password123" })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("logs in with correct credentials", async () => {
    const { context, repository, service } = setup();
    repository.findUserByEmail.mockResolvedValue({
      ...context.user,
      passwordHash: "hashed-password"
    });

    const result = await service.login({ email: "owner@example.com", password: "password123" });

    expect(result.accessToken).toBe("access-user-1");
    expect(result.refreshToken).toBe("refresh-token");
    expect(result.onboardingRequired).toBe(true);
    expect(result.onboardingStep).toBe("business_profile");
    expect(repository.hasPaymentAccountHistory).not.toHaveBeenCalled();
  });

  it("routes a completed business profile without payment account history to payment setup", async () => {
    const { context, repository, service } = setup();
    const completedAt = new Date("2026-01-02T00:00:00.000Z");
    repository.findUserByEmail.mockResolvedValue({
      ...context.user,
      passwordHash: "hashed-password"
    });
    repository.getActiveContextForUser.mockResolvedValue({
      ...context,
      activeOrganisation: {
        ...context.activeOrganisation,
        onboardingCompletedAt: completedAt
      },
      businessProfile: {
        ...context.businessProfile,
        setupCompletedAt: completedAt
      }
    });

    const result = await service.login({ email: "owner@example.com", password: "password123" });

    expect(result.onboardingRequired).toBe(true);
    expect(result.onboardingStep).toBe("payment_setup");
    expect(repository.hasPaymentAccountHistory).toHaveBeenCalledWith("org-1");
  });

  it("completes onboarding when the organisation has submitted any payment account", async () => {
    const { context, repository, service } = setup();
    const completedAt = new Date("2026-01-02T00:00:00.000Z");
    repository.getActiveContextForUser.mockResolvedValue({
      ...context,
      activeOrganisation: {
        ...context.activeOrganisation,
        onboardingCompletedAt: completedAt
      },
      businessProfile: {
        ...context.businessProfile,
        setupCompletedAt: completedAt
      }
    });
    repository.hasPaymentAccountHistory.mockResolvedValue(true);

    const result = await service.getMe("user-1");

    expect(result.onboardingRequired).toBe(false);
    expect(result.onboardingStep).toBeNull();
    expect(repository.hasPaymentAccountHistory).toHaveBeenCalledWith("org-1");
  });

  it("rejects incorrect credentials", async () => {
    const { context, passwordService, repository, service } = setup();
    repository.findUserByEmail.mockResolvedValue({
      ...context.user,
      passwordHash: "hashed-password"
    });
    passwordService.verify.mockResolvedValue(false);

    await expect(
      service.login({ email: "owner@example.com", password: "wrong-password" })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rotates refresh tokens and rejects reuse of the old token", async () => {
    const { service, tokenService } = setup();
    tokenService.generateRefreshToken.mockReturnValueOnce("rotated-refresh-token");

    const result = await service.refresh({ refreshToken: "refresh-token" });

    expect(result.accessToken).toBe("access-user-1");
    expect(result.refreshToken).toBe("rotated-refresh-token");
    await expect(service.refresh({ refreshToken: "refresh-token" })).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it("maps a lost rotation race to an unauthorized error instead of a server error", async () => {
    const { repository, service } = setup();
    repository.rotateRefreshToken.mockRejectedValueOnce(
      new Error("Refresh token was already used.")
    );

    await expect(service.refresh({ refreshToken: "refresh-token" })).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it("revokes refresh token on logout", async () => {
    const { repository, service } = setup();

    await expect(service.logout({ refreshToken: "refresh-token" })).resolves.toEqual({
      success: true
    });
    expect(repository.revokeRefreshToken).toHaveBeenCalledWith("refresh-1");
  });

  it("returns active context for /me", async () => {
    const { service } = setup();

    const result = await service.getMe("user-1");

    expect(result.activeOrganisation.id).toBe("org-1");
    expect(result.membership.role).toBe("owner");
    expect(result.businessProfile.id).toBe("profile-1");
  });

  it("resolves /me through the selected workspace when the header is present", async () => {
    const { service, tenantContextService } = setup();
    const selected = { ...createContext(), activeOrganisation: { ...createContext().activeOrganisation, id: "org-2" } };
    tenantContextService.resolveForUser.mockResolvedValueOnce(selected);

    const result = await service.getMe("user-1", "org-2");

    expect(tenantContextService.resolveForUser).toHaveBeenCalledWith("user-1", "org-2");
    expect(result.activeOrganisation.id).toBe("org-2");
  });

  it("lists organisation memberships with the oldest-default workspace", async () => {
    const { repository, service } = setup();
    const second = {
      ...createContext(),
      activeOrganisation: { ...createContext().activeOrganisation, id: "org-2", name: "Second" },
      membership: { ...createContext().membership, id: "member-2", organisationId: "org-2" }
    };
    repository.listContextsForUser.mockResolvedValueOnce([createContext(), second]);

    const result = await service.getOrganisations("user-1");

    expect(result.organisations).toHaveLength(2);
    expect(result.organisations[1]?.membership.organisationId).toBe("org-2");
    expect(result.activeOrganisationId).toBe("org-1");
  });

  it("selects a workspace the user belongs to and audits the selection", async () => {
    const { context, repository, service, tenantContextService } = setup();

    const result = await service.selectOrganisation("user-1", "org-1");

    expect(tenantContextService.resolveForUser).toHaveBeenCalledWith("user-1", "org-1");
    expect(repository.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        actorUserId: "user-1",
        action: "workspace_selected"
      })
    );
    expect(result.activeOrganisation.id).toBe(context.activeOrganisation.id);
  });

  it("still returns the selection when the selection audit write fails", async () => {
    const { repository, service } = setup();
    repository.createAuditLog.mockRejectedValueOnce(new Error("audit down"));

    const result = await service.selectOrganisation("user-1", "org-1");

    expect(result.activeOrganisation.id).toBe("org-1");
  });

  it("rejects selecting a workspace the user cannot access", async () => {
    const { service, tenantContextService } = setup();
    tenantContextService.resolveForUser.mockRejectedValueOnce(
      new ForbiddenException("You do not have access to the selected workspace.")
    );

    await expect(service.selectOrganisation("user-1", "org-9")).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
});
