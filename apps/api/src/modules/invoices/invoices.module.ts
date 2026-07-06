import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { DatabaseModule } from "../../database/database.module";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { AuthRepository } from "../auth/auth.repository";
import { TokenService } from "../auth/token.service";
import { PaymentsModule } from "../payments/payments.module";
import { PaystackModule } from "../paystack/paystack.module";
import { TenantContextService } from "../tenant/tenant-context.service";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";
import { PublicInvoicesController } from "./public-invoices.controller";

@Module({
  imports: [ConfigModule, DatabaseModule, AuditLogModule, PaystackModule, PaymentsModule],
  controllers: [InvoicesController, PublicInvoicesController],
  providers: [
    AuthRepository,
    InvoicesService,
    JwtAuthGuard,
    RolesGuard,
    TenantContextService,
    TokenService
  ]
})
export class InvoicesModule {}
