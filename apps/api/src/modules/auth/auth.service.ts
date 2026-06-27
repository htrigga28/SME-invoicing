import { ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";

import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { LogoutDto } from "./dto/logout.dto";
import { AuthRepository } from "./auth.repository";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import type { ActiveOrganisationContext } from "../../common/types/request-context";

type AuthSessionResponse = ActiveOrganisationContext & {
  accessToken: string;
  refreshToken: string;
  onboardingRequired: boolean;
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(AuthRepository) private readonly authRepository: AuthRepository,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(TokenService) private readonly tokenService: TokenService
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
      onboardingRequired: true
    };
  }

  async login(input: LoginDto): Promise<AuthSessionResponse> {
    const email = this.normalizeEmail(input.email);
    const user = await this.authRepository.findUserByEmail(email);

    if (!user) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const passwordMatches = await this.passwordService.verify(user.passwordHash, input.password);

    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const context = await this.authRepository.getActiveContextForUser(user.id);

    if (!context) {
      throw new UnauthorizedException("No active organisation membership was found.");
    }

    const rawRefreshToken = this.tokenService.generateRefreshToken();
    await this.authRepository.createRefreshToken(
      user.id,
      this.tokenService.hashRefreshToken(rawRefreshToken),
      this.tokenService.getRefreshTokenExpiry()
    );

    return {
      ...context,
      accessToken: this.tokenService.signAccessToken(user.id),
      refreshToken: rawRefreshToken,
      onboardingRequired: this.isOnboardingRequired(context)
    };
  }

  async refresh(input: RefreshTokenDto) {
    const tokenHash = this.tokenService.hashRefreshToken(input.refreshToken);
    const refreshToken = await this.authRepository.findRefreshTokenByHash(tokenHash);

    if (!refreshToken || refreshToken.revokedAt || refreshToken.expiresAt <= new Date()) {
      throw new UnauthorizedException("Invalid or expired refresh token.");
    }

    const rawRefreshToken = this.tokenService.generateRefreshToken();
    await this.authRepository.rotateRefreshToken(
      refreshToken.id,
      refreshToken.userId,
      this.tokenService.hashRefreshToken(rawRefreshToken),
      this.tokenService.getRefreshTokenExpiry()
    );

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

  async getMe(userId: string) {
    const context = await this.authRepository.getActiveContextForUser(userId);

    if (!context) {
      throw new UnauthorizedException("No active organisation membership was found.");
    }

    return {
      ...context,
      onboardingRequired: this.isOnboardingRequired(context)
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

  private isOnboardingRequired(context: ActiveOrganisationContext) {
    return (
      context.businessProfile.setupCompletedAt === null ||
      context.activeOrganisation.onboardingCompletedAt === null
    );
  }
}
