import { ConflictException, UnauthorizedException } from "@nestjs/common";

import type { ActiveOrganisationContext } from "../../common/types/request-context";
import { AuthService } from "./auth.service";
import type { AuthRepository } from "./auth.repository";
import type { PasswordService } from "./password.service";
import type { TokenService } from "./token.service";

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
      })
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
    const service = new AuthService(
      repository as unknown as AuthRepository,
      passwordService as unknown as PasswordService,
      tokenService as unknown as TokenService
    );

    return { context, passwordService, repository, service, tokenService };
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
});
