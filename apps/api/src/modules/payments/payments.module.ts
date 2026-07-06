import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { DatabaseModule } from "../../database/database.module";
import { AuthRepository } from "../auth/auth.repository";
import { PaystackModule } from "../paystack/paystack.module";
import { TokenService } from "../auth/token.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [ConfigModule, DatabaseModule, PaystackModule],
  controllers: [PaymentsController],
  providers: [
    AuthRepository,
    JwtAuthGuard,
    PaymentsService,
    RolesGuard,
    TenantContextService,
    TokenService
  ],
  exports: [PaymentsService]
})
export class PaymentsModule {}
