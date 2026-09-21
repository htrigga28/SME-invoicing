import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger
} from "@nestjs/common";

import { AuthRepository } from "../auth/auth.repository";

export const ORGANISATION_ID_HEADER = "x-organisation-id";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class TenantContextService {
  private readonly logger = new Logger(TenantContextService.name);

  constructor(@Inject(AuthRepository) private readonly authRepository: AuthRepository) {}

  async resolveForUser(
    userId: string,
    requestedOrganisationId?: unknown,
    options?: { requireExplicit?: boolean }
  ) {
    const normalised = this.normaliseHeader(requestedOrganisationId);

    if (normalised !== undefined) {
      if (!UUID_PATTERN.test(normalised)) {
        throw new BadRequestException("The selected workspace is not valid.");
      }

      const context = await this.authRepository.getContextForUserAndOrg(userId, normalised);

      if (!context) {
        // Deliberately 403 without an existence oracle: a foreign, revoked, or
        // mistyped organisation all look the same to the caller.
        throw new ForbiddenException("You do not have access to the selected workspace.");
      }

      return context;
    }

    // Mutations must never silently choose an organisation: a client bug that
    // omits the workspace header could otherwise write to the user's oldest
    // organisation. Reads keep the logged compat default while clients
    // migrate to the explicit header.
    if (options?.requireExplicit) {
      throw new BadRequestException(
        "Select a workspace before changing business data."
      );
    }

    const context = await this.authRepository.getActiveContextForUser(userId);

    if (!context) {
      throw new ForbiddenException("No active organisation membership was found.");
    }

    // Compat default while clients migrate to the explicit header. Counted via
    // logs so the dated header-required enforcement can be driven by data.
    this.logger.warn(
      `oldest-default organisation selected user=${userId} org=${context.activeOrganisation.id}`
    );

    return context;
  }

  private normaliseHeader(value: unknown): string | undefined {
    const raw = Array.isArray(value) ? value[0] : value;

    if (raw === undefined || raw === null) {
      return undefined;
    }

    if (typeof raw !== "string") {
      throw new BadRequestException("The selected workspace is not valid.");
    }

    const trimmed = raw.trim();

    return trimmed ? trimmed : undefined;
  }
}
