import { BadRequestException, ForbiddenException } from "@nestjs/common";

import type { ActiveOrganisationContext } from "../../common/types/request-context";
import type { AuthRepository } from "../auth/auth.repository";
import { TenantContextService } from "./tenant-context.service";

const ORG_1 = "11111111-1111-4111-8111-111111111111";
const ORG_2 = "22222222-2222-4222-8222-222222222222";

function createContext(organisationId: string): ActiveOrganisationContext {
  const now = new Date("2026-01-01T00:00:00.000Z");

  return {
    user: {
      id: "user-1",
      email: "owner@example.com",
      name: "Owner User",
      createdAt: now,
      updatedAt: now
    },
    activeOrganisation: {
      id: organisationId,
      name: "Workspace",
      slug: "workspace",
      onboardingCompletedAt: now,
      createdAt: now,
      updatedAt: now
    },
    membership: {
      id: "member-1",
      organisationId,
      userId: "user-1",
      role: "owner",
      status: "active",
      createdAt: now,
      updatedAt: now
    },
    businessProfile: {
      id: "profile-1",
      organisationId,
      businessName: "Workspace",
      email: null,
      phone: null,
      address: null,
      logoFileId: null,
      setupCompletedAt: now,
      createdAt: now,
      updatedAt: now
    }
  };
}

function setup() {
  const repository = {
    getActiveContextForUser: jest.fn().mockResolvedValue(createContext(ORG_1)),
    getContextForUserAndOrg: jest.fn(async (_userId: string, organisationId: string) =>
      organisationId === ORG_2 ? createContext(ORG_2) : undefined
    )
  };
  const service = new TenantContextService(repository as unknown as AuthRepository);

  return { repository, service };
}

describe("TenantContextService", () => {
  it("resolves the explicitly selected workspace instead of the oldest membership", async () => {
    const { repository, service } = setup();

    const context = await service.resolveForUser("user-1", ORG_2);

    expect(repository.getContextForUserAndOrg).toHaveBeenCalledWith("user-1", ORG_2);
    expect(repository.getActiveContextForUser).not.toHaveBeenCalled();
    expect(context.activeOrganisation.id).toBe(ORG_2);
  });

  it("rejects a workspace the user cannot access without an existence oracle", async () => {
    const { service } = setup();

    await expect(
      service.resolveForUser("user-1", "33333333-3333-4333-8333-333333333333")
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects malformed workspace identifiers", async () => {
    const { repository, service } = setup();

    await expect(service.resolveForUser("user-1", "not-a-uuid")).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(service.resolveForUser("user-1", 42)).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(repository.getContextForUserAndOrg).not.toHaveBeenCalled();
  });

  it("accepts the first value of a repeated header", async () => {
    const { service } = setup();

    const context = await service.resolveForUser("user-1", [ORG_2, ORG_1]);

    expect(context.activeOrganisation.id).toBe(ORG_2);
  });

  it("falls back to the oldest membership when no workspace is selected", async () => {
    const { repository, service } = setup();

    const context = await service.resolveForUser("user-1", undefined);

    expect(repository.getActiveContextForUser).toHaveBeenCalledWith("user-1");
    expect(context.activeOrganisation.id).toBe(ORG_1);
  });

  it("fails closed for mutations when no workspace is selected", async () => {
    const { repository, service } = setup();

    await expect(
      service.resolveForUser("user-1", undefined, { requireExplicit: true })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.getActiveContextForUser).not.toHaveBeenCalled();
    expect(repository.getContextForUserAndOrg).not.toHaveBeenCalled();
  });

  it("still validates an explicit workspace when explicit selection is required", async () => {
    const { repository, service } = setup();

    const context = await service.resolveForUser("user-1", ORG_2, { requireExplicit: true });

    expect(repository.getContextForUserAndOrg).toHaveBeenCalledWith("user-1", ORG_2);
    expect(context.activeOrganisation.id).toBe(ORG_2);
  });

  it("rejects when the user has no active membership", async () => {
    const { repository, service } = setup();
    repository.getActiveContextForUser.mockResolvedValueOnce(undefined);

    await expect(service.resolveForUser("user-1")).rejects.toBeInstanceOf(ForbiddenException);
  });
});
