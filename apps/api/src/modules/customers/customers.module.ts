import { Module } from "@nestjs/common";

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { DatabaseModule } from "../../database/database.module";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { AuthRepository } from "../auth/auth.repository";
import { TokenService } from "../auth/token.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";

@Module({
  imports: [DatabaseModule, AuditLogModule],
  controllers: [CustomersController],
  providers: [
    AuthRepository,
    CustomersService,
    JwtAuthGuard,
    RolesGuard,
    TenantContextService,
    TokenService
  ]
})
export class CustomersModule {}
