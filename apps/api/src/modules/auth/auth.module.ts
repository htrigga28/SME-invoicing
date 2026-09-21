import { Module } from "@nestjs/common";

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { DatabaseModule } from "../../database/database.module";
import { TenantModule } from "../tenant/tenant.module";
import { AuthController } from "./auth.controller";
import { AuthRepository } from "./auth.repository";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";

@Module({
  imports: [DatabaseModule, TenantModule],
  controllers: [AuthController],
  providers: [AuthRepository, AuthService, JwtAuthGuard, PasswordService, TokenService],
  exports: [AuthRepository, AuthService, PasswordService, TokenService]
})
export class AuthModule {}
