import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomBytes } from "crypto";
import jwt, { JwtPayload } from "jsonwebtoken";

type AccessTokenPayload = {
  userId: string;
};

@Injectable()
export class TokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    this.accessSecret = configService.getOrThrow<string>("JWT_ACCESS_SECRET");
    this.refreshSecret = configService.getOrThrow<string>("JWT_REFRESH_SECRET");
  }

  signAccessToken(userId: string): string {
    return jwt.sign({ sub: userId }, this.accessSecret, { expiresIn: "15m" });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const payload = jwt.verify(token, this.accessSecret) as JwtPayload;

      if (typeof payload.sub !== "string") {
        throw new UnauthorizedException("Invalid access token.");
      }

      return { userId: payload.sub };
    } catch {
      throw new UnauthorizedException("Invalid or expired access token.");
    }
  }

  generateRefreshToken(): string {
    return randomBytes(48).toString("base64url");
  }

  hashRefreshToken(refreshToken: string): string {
    return createHmac("sha256", this.refreshSecret).update(refreshToken).digest("hex");
  }

  getRefreshTokenExpiry(): Date {
    return new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  }
}
