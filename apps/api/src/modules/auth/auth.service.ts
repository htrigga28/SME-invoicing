import { ConflictException, Inject, Injectable, Logger, UnauthorizedException } from "@nestjs/common";

import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { LogoutDto } from "./dto/logout.dto";
import { AuthRepository } from "./auth.repository";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import type {
  ActiveOrganisationContext,
  SafeUser
} from "../../common/types/request-context";
import type { Organisation, OrganisationMember } from "../../database/schema";

type AuthSessionResponse = ActiveOrganisationContext & {
  accessToken: string;
  refreshToken: string;
  onboardingRequired: boolean;
  onboardingStep: OnboardingStep;
};

export type WorkspaceSelectionRequired = {
  user: SafeUser;
  selectionRequired: true;
  organisations: Array<{ organisation: Organisation; membership: OrganisationMember }>;
  accessToken: string;
  refreshToken: string;
};

export type LoginResponse =
  | (AuthSessionResponse & { selectionRequired: false })
  | WorkspaceSelectionRequired;

export type OnboardingStep = "business_profile" | "payment_setup" | null;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(AuthRepository) private readonly authRepository: AuthRepository,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(TokenService) private readonly tokenService: TokenService,
    @Inject(TenantContextService) private readonly tenantContextService: TenantContextService
  ) {}

  async register(input: RegisterDto): Promise<AuthSessionResponse> {
    const email = this.normalizeEmail(input.email);
    const existingUser = await this.authRepository.findUserByEmail(email);

    if (existingUser) {
      throw new ConflictException("A user with this email already exists.");
    }

    const rawRefreshToken = this.tokenService.generateRefreshToken();
    const passwordHash = await this.passwordService.hash(input.password);
    const registration = await this.authRepository.register({
      email,
      passwordHash,
      name: input.name.trim(),
      organisationName: `${input.name.trim()}'s Workspace`,
      organisationSlug: this.createOrganisationSlug(input.name),
      refreshTokenHash: this.tokenService.hashRefreshToken(rawRefreshToken),
      refreshTokenExpiresAt: this.tokenService.getRefreshTokenExpiry()
    });

    return {
      ...registration,
      accessToken: this.tokenService.signAccessToken(registration.user.id),
      refreshToken: rawRefreshToken,
      onboardingRequired: true,
      onboardingStep: "business_profile"
    };
  }

  async login(input: LoginDto): Promise<LoginResponse> {
    const email = this.normalizeEmail(input.email);
    const user = await this.authRepository.findUserByEmail(email);

    if (!user) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const passwordMatches = await this.passwordService.verify(user.passwordHash, input.password);

    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const contexts = await this.authRepository.listContextsForUser(user.id);

    if (contexts.length === 0) {
      throw new UnauthorizedException("No active organisation membership was found.");
    }

    const rawRefreshToken = this.tokenService.generateRefreshToken();
    await this.authRepository.createRefreshToken(
      user.id,
      this.tokenService.hashRefreshToken(rawRefreshToken),
      this.tokenService.getRefreshTokenExpiry()
    );
    const accessToken = this.tokenService.signAccessToken(user.id);

    // Multiple active workspaces require an explicit choice. The session is
    // valid, but no workspace is selected silently: the client must call
    // POST /session/organisation before any tenant data loads.
    if (contexts.length > 1) {
      return {
        user: contexts[0]!.user,
        selectionRequired: true as const,
        organisations: contexts.map((context) => ({
          organisation: context.activeOrganisation,
          membership: context.membership
        })),
        accessToken,
        refreshToken: rawRefreshToken
      };
    }

    const context = contexts[0]!;
    const onboardingStep = await this.getOnboardingStep(context);

    return {
      ...context,
      accessToken,
      refreshToken: rawRefreshToken,
      onboardingRequired: onboardingStep !== null,
      onboardingStep,
      selectionRequired: false as const
    };
  }

  async refresh(input: RefreshTokenDto) {
    if (!input.refreshToken) {
      throw new UnauthorizedException("Invalid or expired refresh token.");
    }

    const tokenHash = this.tokenService.hashRefreshToken(input.refreshToken);
    const refreshToken = await this.authRepository.findRefreshTokenByHash(tokenHash);

    if (!refreshToken || refreshToken.revokedAt || refreshToken.expiresAt <= new Date()) {
      throw new UnauthorizedException("Invalid or expired refresh token.");
    }

    const rawRefreshToken = this.tokenService.generateRefreshToken();
    try {
      await this.authRepository.rotateRefreshToken(
        refreshToken.id,
        refreshToken.userId,
        this.tokenService.hashRefreshToken(rawRefreshToken),
        this.tokenService.getRefreshTokenExpiry()
      );
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token.");
    }

    return {
      accessToken: this.tokenService.signAccessToken(refreshToken.userId),
      refreshToken: rawRefreshToken
    };
  }

  async logout(input: LogoutDto) {
    if (input.refreshToken) {
      const tokenHash = this.tokenService.hashRefreshToken(input.refreshToken);
      const refreshToken = await this.authRepository.findRefreshTokenByHash(tokenHash);

      if (refreshToken && !refreshToken.revokedAt) {
        await this.authRepository.revokeRefreshToken(refreshToken.id);
      }
    }

    return { success: true };
  }

  async getMe(userId: string, requestedOrganisationId?: unknown) {
    if (requestedOrganisationId === undefined) {
      const context = await this.authRepository.getActiveContextForUser(userId);

      if (!context) {
        throw new UnauthorizedException("No active organisation membership was found.");
      }
      const onboardingStep = await this.getOnboardingStep(context);

      return {
        ...context,
        onboardingRequired: onboardingStep !== null,
        onboardingStep
      };
    }

    const context = await this.tenantContextService.resolveForUser(
      userId,
      requestedOrganisationId
    );
    const onboardingStep = await this.getOnboardingStep(context);

    return {
      ...context,
      onboardingRequired: onboardingStep !== null,
      onboardingStep
    };
  }

  async getOrganisations(userId: string) {
    const contexts = await this.authRepository.listContextsForUser(userId);

    return {
      organisations: contexts.map((context) => ({
        organisation: context.activeOrganisation,
        membership: context.membership
      })),
      // Oldest membership is the compat default used when no header is sent.
      activeOrganisationId: contexts[0]?.activeOrganisation.id ?? null
    };
  }

  async selectOrganisation(userId: string, organisationId: string) {
    const context = await this.tenantContextService.resolveForUser(userId, organisationId);

    // Selection audit is observability: a validated selection must never fail
    // because the audit write did.
    try {
      await this.authRepository.createAuditLog({
        organisationId: context.activeOrganisation.id,
        actorUserId: userId,
        action: "workspace_selected",
        entityType: "organisation",
        entityId: context.activeOrganisation.id,
        metadataRedacted: { membershipId: context.membership.id }
      });
    } catch (error) {
      this.logger.warn(
        `workspace_selected audit failed user=${userId} org=${context.activeOrganisation.id}: ${error instanceof Error ? error.message : "unknown"}`
      );
    }

    const onboardingStep = await this.getOnboardingStep(context);

    return {
      ...context,
      onboardingRequired: onboardingStep !== null,
      onboardingStep
    };
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private createOrganisationSlug(name: string) {
    const baseSlug =
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "workspace";
    const suffix = Math.random().toString(36).slice(2, 8);

    return `${baseSlug}-${suffix}`;
  }

  private async getOnboardingStep(context: ActiveOrganisationContext): Promise<OnboardingStep> {
    if (
      context.businessProfile.setupCompletedAt === null ||
      context.activeOrganisation.onboardingCompletedAt === null
    ) {
      return "business_profile";
    }

    const hasPaymentAccountHistory = await this.authRepository.hasPaymentAccountHistory(
      context.activeOrganisation.id
    );

    return hasPaymentAccountHistory ? null : "payment_setup";
  }
}
