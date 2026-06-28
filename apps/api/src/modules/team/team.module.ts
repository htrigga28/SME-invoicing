import { Module } from "@nestjs/common";

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../common/guards/optional-jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { DatabaseModule } from "../../database/database.module";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { AuthRepository } from "../auth/auth.repository";
import { PasswordService } from "../auth/password.service";
import { TokenService } from "../auth/token.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { PublicInvitationsController, TeamController } from "./team.controller";
import { TeamService } from "./team.service";

@Module({
  imports: [DatabaseModule, AuditLogModule],
  controllers: [TeamController, PublicInvitationsController],
  providers: [
    AuthRepository,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    PasswordService,
    RolesGuard,
    TeamService,
    TenantContextService,
    TokenService
  ]
})
export class TeamModule {}
