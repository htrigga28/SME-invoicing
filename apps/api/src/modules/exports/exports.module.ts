import { Module } from "@nestjs/common";

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { DatabaseModule } from "../../database/database.module";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { AuthRepository } from "../auth/auth.repository";
import { TokenService } from "../auth/token.service";
import { PaymentsModule } from "../payments/payments.module";
import { ReceiptsModule } from "../receipts/receipts.module";
import { TenantContextService } from "../tenant/tenant-context.service";
import { ExportsController } from "./exports.controller";
import { ExportsService } from "./exports.service";

@Module({
  imports: [DatabaseModule, AuditLogModule, PaymentsModule, ReceiptsModule],
  controllers: [ExportsController],
  providers: [
    AuthRepository,
    ExportsService,
    JwtAuthGuard,
    RolesGuard,
    TenantContextService,
    TokenService
  ]
})
export class ExportsModule {}
