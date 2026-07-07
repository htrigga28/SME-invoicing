import { Module } from "@nestjs/common";

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { DatabaseModule } from "../../database/database.module";
import { AuthRepository } from "../auth/auth.repository";
import { PaymentsModule } from "../payments/payments.module";
import { TenantContextService } from "../tenant/tenant-context.service";
import { TokenService } from "../auth/token.service";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [DatabaseModule, PaymentsModule],
  controllers: [DashboardController],
  providers: [
    AuthRepository,
    DashboardService,
    JwtAuthGuard,
    RolesGuard,
    TenantContextService,
    TokenService
  ]
})
export class DashboardModule {}
