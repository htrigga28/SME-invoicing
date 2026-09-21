import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Logger,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ORGANISATION_ID_HEADER } from "../tenant/tenant-context.service";
import type { AuthenticatedUser } from "../../common/types/request-context";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { LogoutDto } from "./dto/logout.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";
import { SelectOrganisationDto } from "./dto/select-organisation.dto";
import {
  clearRefreshCookie,
  readRefreshCookie,
  readRequestOrigin,
  setRefreshCookie,
  type CookieRequest,
  type CookieResponse
} from "./refresh-cookie";

@ApiTags("Auth")
@Controller()
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(ConfigService) private readonly configService: ConfigService
  ) {}

  @Post("auth/register")
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @UseGuards(ThrottlerGuard)
  async register(@Body() body: RegisterDto, @Res({ passthrough: true }) res: CookieResponse) {
    const session = await this.authService.register(body);
    setRefreshCookie(res, session.refreshToken, this.secureCookies());
    return this.toBrowserSession(session);
  }

  @Post("auth/login")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(ThrottlerGuard)
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: CookieResponse) {
    const session = await this.authService.login(body);
    setRefreshCookie(res, session.refreshToken, this.secureCookies());
    return this.toBrowserSession(session);
  }

  @Post("auth/refresh")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(ThrottlerGuard)
  async refresh(
    @Req() req: CookieRequest,
    @Res({ passthrough: true }) res: CookieResponse,
    @Body() body?: RefreshTokenDto
  ) {
    const cookieToken = readRefreshCookie(req);

    if (cookieToken) {
      // Cookie-authenticated refresh requires a valid Origin: the cookie is
      // ambient authority, so the allowlisted web origin must have initiated it.
      this.assertAllowedOrigin(req);
      const session = await this.authService.refresh({ refreshToken: cookieToken });
      setRefreshCookie(res, session.refreshToken, this.secureCookies());
      return this.toBrowserSession(session);
    }

    if (body?.refreshToken && this.legacyBodyEnabled()) {
      // Compat window for pre-cookie clients. Counted so the removal
      // follow-up can be driven by data. Never log the token itself.
      this.logger.warn("legacy-refresh-body used");
      const session = await this.authService.refresh({ refreshToken: body.refreshToken });
      setRefreshCookie(res, session.refreshToken, this.secureCookies());
      return session;
    }

    throw new UnauthorizedException("Authentication is required.");
  }

  @Post("auth/logout")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(ThrottlerGuard)
  async logout(
    @Req() req: CookieRequest,
    @Res({ passthrough: true }) res: CookieResponse,
    @Body() body?: LogoutDto
  ) {
    const tokens = new Set(
      [readRefreshCookie(req), body?.refreshToken].filter((token): token is string => Boolean(token))
    );

    for (const token of tokens) {
      await this.authService.logout({ refreshToken: token });
    }

    clearRefreshCookie(res, this.secureCookies());

    return { success: true };
  }

  private secureCookies(): boolean {
    return this.configService.get<string>("NODE_ENV") === "production";
  }

  private legacyBodyEnabled(): boolean {
    return this.configService.get<string>("LEGACY_REFRESH_BODY_ENABLED") !== "false";
  }

  private allowedOrigins(): string[] {
    return this.configService
      .get<string>("CORS_ORIGINS", "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  private assertAllowedOrigin(req: CookieRequest) {
    const origin = readRequestOrigin(req);

    if (!origin || !this.allowedOrigins().includes(origin)) {
      throw new ForbiddenException("Request origin is not allowed.");
    }
  }

  private toBrowserSession<T extends { refreshToken: string }>(session: T): Omit<T, "refreshToken"> {
    const { refreshToken: _refreshToken, ...browserSession } = session;
    return browserSession;
  }

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(
    @CurrentUser() user: AuthenticatedUser,
    @Headers(ORGANISATION_ID_HEADER) organisationId?: string
  ) {
    return this.authService.getMe(user.userId, organisationId);
  }

  @Get("me/organisations")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  organisations(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getOrganisations(user.userId);
  }

  @Post("session/organisation")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  selectOrganisation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SelectOrganisationDto
  ) {
    return this.authService.selectOrganisation(user.userId, body.organisationId);
  }
}
