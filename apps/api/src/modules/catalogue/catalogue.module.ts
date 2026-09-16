import { Module } from "@nestjs/common";

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { DatabaseModule } from "../../database/database.module";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { AuthRepository } from "../auth/auth.repository";
import { TokenService } from "../auth/token.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { CatalogueController } from "./catalogue.controller";
import { CatalogueService } from "./catalogue.service";

@Module({
  imports: [DatabaseModule, AuditLogModule],
  controllers: [CatalogueController],
  providers: [
    AuthRepository,
    CatalogueService,
    JwtAuthGuard,
    RolesGuard,
    TenantContextService,
    TokenService
  ]
})
export class CatalogueModule {}
