import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../database/database.module";
import { AuthRepository } from "../auth/auth.repository";
import { TokenService } from "../auth/token.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantContextService } from "../tenant/tenant-context.service";
import { AuditLogsController } from "./audit-log.controller";
import { AuditLogService } from "./audit-log.service";

@Module({
  imports: [DatabaseModule],
  controllers: [AuditLogsController],
  providers: [
    AuditLogService,
    AuthRepository,
    JwtAuthGuard,
    RolesGuard,
    TenantContextService,
    TokenService
  ],
  exports: [AuditLogService]
})
export class AuditLogModule {}
