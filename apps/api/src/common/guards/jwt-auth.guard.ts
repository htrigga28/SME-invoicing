import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";

import { TokenService } from "../../modules/auth/token.service";
import type { AuthenticatedRequest } from "../types/request-context";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(TokenService) private readonly tokenService: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Authentication is required.");
    }

    const accessToken = authorization.slice("Bearer ".length);
    const payload = this.tokenService.verifyAccessToken(accessToken);
    request.authUser = { userId: payload.userId };

    return true;
  }
}
