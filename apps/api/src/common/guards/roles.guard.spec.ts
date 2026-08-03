import { ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";

import type { AuthRepository } from "../../modules/auth/auth.repository";
import type { TenantContextService } from "../../modules/tenant/tenant-context.service";
import { ALLOW_INCOMPLETE_ONBOARDING_KEY } from "../decorators/allow-incomplete-onboarding.decorator";
import { ROLES_KEY } from "../decorators/roles.decorator";
import type { ActiveOrganisationContext, AuthenticatedRequest } from "../types/request-context";
import { RolesGuard } from "./roles.guard";

const completedAt = new Date("2026-08-03T00:00:00.000Z");
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
    onboardingCompletedAt: completedAt,
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
    businessName: "Workspace",
    email: "billing@example.com",
    phone: "+2348012345678",
    address: "Lagos",
    logoFileId: null,
    setupCompletedAt: completedAt,
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

function createGuard({
  allowIncompleteOnboarding = false,
  paymentAccountExists = true,
  tenant = context
}: {
  allowIncompleteOnboarding?: boolean;
  paymentAccountExists?: boolean;
  tenant?: ActiveOrganisationContext;
} = {}) {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => {
      if (key === ROLES_KEY) {
        return ["owner", "admin"];
      }

      if (key === ALLOW_INCOMPLETE_ONBOARDING_KEY) {
        return allowIncompleteOnboarding;
      }

      return undefined;
    })
  };
  const tenantContextService = {
    resolveForUser: jest.fn().mockResolvedValue(tenant)
  };
  const authRepository = {
    hasPaymentAccountHistory: jest.fn().mockResolvedValue(paymentAccountExists)
  };
  const guard = new RolesGuard(
    reflector as unknown as Reflector,
    tenantContextService as unknown as TenantContextService,
    authRepository as unknown as AuthRepository
  );

  return { authRepository, guard };
}

function authenticatedContext() {
  return createExecutionContext({ authUser: { userId: "user-1" } } as AuthenticatedRequest);
}

describe("RolesGuard", () => {
  it("rejects accountant for Owner/Admin-only routes", async () => {
    const { guard } = createGuard();

    await expect(guard.canActivate(authenticatedContext())).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("allows an onboarded owner for Owner/Admin-only routes", async () => {
    const { authRepository, guard } = createGuard({
      tenant: { ...context, membership: { ...context.membership, role: "owner" } }
    });

    await expect(guard.canActivate(authenticatedContext())).resolves.toBe(true);
    expect(authRepository.hasPaymentAccountHistory).toHaveBeenCalledWith("org-1");
  });

  it("blocks workspace routes at the incomplete business profile step", async () => {
    const { authRepository, guard } = createGuard({
      tenant: {
        ...context,
        activeOrganisation: { ...context.activeOrganisation, onboardingCompletedAt: null },
        businessProfile: { ...context.businessProfile, setupCompletedAt: null },
        membership: { ...context.membership, role: "owner" }
      }
    });

    await expect(guard.canActivate(authenticatedContext())).rejects.toMatchObject({
      response: { onboardingStep: "business_profile" },
      status: 409
    });
    expect(authRepository.hasPaymentAccountHistory).not.toHaveBeenCalled();
  });

  it("blocks workspace routes at Payment Setup when no account history exists", async () => {
    const { guard } = createGuard({
      paymentAccountExists: false,
      tenant: { ...context, membership: { ...context.membership, role: "owner" } }
    });

    await expect(guard.canActivate(authenticatedContext())).rejects.toMatchObject({
      response: { onboardingStep: "payment_setup" },
      status: 409
    });
  });

  it("allows setup endpoints while onboarding is incomplete", async () => {
    const { authRepository, guard } = createGuard({
      allowIncompleteOnboarding: true,
      tenant: {
        ...context,
        activeOrganisation: { ...context.activeOrganisation, onboardingCompletedAt: null },
        businessProfile: { ...context.businessProfile, setupCompletedAt: null },
        membership: { ...context.membership, role: "owner" }
      }
    });

    await expect(guard.canActivate(authenticatedContext())).resolves.toBe(true);
    expect(authRepository.hasPaymentAccountHistory).not.toHaveBeenCalled();
  });
});
