import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { validateEnv } from "./config/env.validation";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health.controller";
import { AuthModule } from "./modules/auth/auth.module";
import { BusinessProfileModule } from "./modules/business-profile/business-profile.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { InvoicesModule } from "./modules/invoices/invoices.module";
import { PaymentSetupModule } from "./modules/payment-setup/payment-setup.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { TeamModule } from "./modules/team/team.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv
    }),
    DatabaseModule,
    AuthModule,
    BusinessProfileModule,
    CustomersModule,
    InvoicesModule,
    PaymentSetupModule,
    PaymentsModule,
    TeamModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
