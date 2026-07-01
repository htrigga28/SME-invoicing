import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { DatabaseModule } from "../../database/database.module";
import { AuthRepository } from "../auth/auth.repository";
import { TokenService } from "../auth/token.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { PaystackClient } from "./paystack.client";
import { PaymentSetupController } from "./payment-setup.controller";
import { PaymentSetupRepository } from "./payment-setup.repository";
import { PaymentSetupService } from "./payment-setup.service";

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [PaymentSetupController],
  providers: [
    AuthRepository,
    JwtAuthGuard,
    PaystackClient,
    PaymentSetupRepository,
    PaymentSetupService,
    RolesGuard,
    TenantContextService,
    TokenService
  ]
})
export class PaymentSetupModule {}
