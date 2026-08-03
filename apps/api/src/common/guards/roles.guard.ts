import {
  CanActivate,
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { AuthRepository } from "../../modules/auth/auth.repository";
import { TenantContextService } from "../../modules/tenant/tenant-context.service";
import { ALLOW_INCOMPLETE_ONBOARDING_KEY } from "../decorators/allow-incomplete-onboarding.decorator";
import { ROLES_KEY } from "../decorators/roles.decorator";
import type { AuthenticatedRequest, RoleRequirement } from "../types/request-context";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(TenantContextService) private readonly tenantContextService: TenantContextService,
    @Inject(AuthRepository) private readonly authRepository: AuthRepository
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<RoleRequirement[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!roles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.authUser) {
      throw new ForbiddenException("Authentication context is missing.");
    }

    const tenant = await this.tenantContextService.resolveForUser(request.authUser.userId);
    request.tenant = tenant;

    if (!roles.includes(tenant.membership.role)) {
      throw new ForbiddenException("Your role cannot perform this action.");
    }

    const allowIncompleteOnboarding = this.reflector.getAllAndOverride<boolean>(
      ALLOW_INCOMPLETE_ONBOARDING_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (allowIncompleteOnboarding) {
      return true;
    }

    if (
      tenant.businessProfile.setupCompletedAt === null ||
      tenant.activeOrganisation.onboardingCompletedAt === null
    ) {
      throw new ConflictException({
        message: "Complete the business profile before accessing the workspace.",
        onboardingStep: "business_profile"
      });
    }

    const hasPaymentAccountHistory = await this.authRepository.hasPaymentAccountHistory(
      tenant.activeOrganisation.id
    );

    if (!hasPaymentAccountHistory) {
      throw new ConflictException({
        message: "Complete Payment Setup before accessing the workspace.",
        onboardingStep: "payment_setup"
      });
    }

    return true;
  }
}
