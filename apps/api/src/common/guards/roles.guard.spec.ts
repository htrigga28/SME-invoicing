import { ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";

import type { TenantContextService } from "../../modules/tenant/tenant-context.service";
import type { ActiveOrganisationContext, AuthenticatedRequest } from "../types/request-context";
import { RolesGuard } from "./roles.guard";

const context = {
  user: {
    id: "user-1",
    email: "user@example.com",
    name: "User",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  activeOrganisation: {
    id: "org-1",
    name: "Workspace",
    slug: "workspace",
    onboardingCompletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  membership: {
    id: "member-1",
    organisationId: "org-1",
    userId: "user-1",
    role: "accountant",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date()
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
    createdAt: new Date(),
    updatedAt: new Date()
  }
} satisfies ActiveOrganisationContext;

function createExecutionContext(request: AuthenticatedRequest): ExecutionContext {
  return {
    getClass: jest.fn(),
    getHandler: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => request
    })
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  it("rejects accountant for Owner/Admin-only routes", async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["owner", "admin"])
    };
    const tenantContextService = {
      resolveForUser: jest.fn().mockResolvedValue(context)
    };
    const guard = new RolesGuard(
      reflector as unknown as Reflector,
      tenantContextService as unknown as TenantContextService
    );

    await expect(
      guard.canActivate(
        createExecutionContext({ authUser: { userId: "user-1" } } as AuthenticatedRequest)
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows owner for Owner/Admin-only routes", async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["owner", "admin"])
    };
    const tenantContextService = {
      resolveForUser: jest.fn().mockResolvedValue({
        ...context,
        membership: { ...context.membership, role: "owner" }
      })
    };
    const guard = new RolesGuard(
      reflector as unknown as Reflector,
      tenantContextService as unknown as TenantContextService
    );

    await expect(
      guard.canActivate(
        createExecutionContext({ authUser: { userId: "user-1" } } as AuthenticatedRequest)
      )
    ).resolves.toBe(true);
  });
});
