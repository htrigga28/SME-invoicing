import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { TenantContextService } from "../../modules/tenant/tenant-context.service";
import { ROLES_KEY } from "../decorators/roles.decorator";
import type { AuthenticatedRequest, RoleRequirement } from "../types/request-context";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(TenantContextService) private readonly tenantContextService: TenantContextService
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

    return true;
  }
}
