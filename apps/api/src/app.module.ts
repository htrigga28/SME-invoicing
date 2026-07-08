import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { validateEnv } from "./config/env.validation";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health.controller";
import { AuthModule } from "./modules/auth/auth.module";
import { AuditLogModule } from "./modules/audit-log/audit-log.module";
import { BusinessProfileModule } from "./modules/business-profile/business-profile.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { ExportsModule } from "./modules/exports/exports.module";
import { InvoicesModule } from "./modules/invoices/invoices.module";
import { PaymentSetupModule } from "./modules/payment-setup/payment-setup.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { ReceiptsModule } from "./modules/receipts/receipts.module";
import { TeamModule } from "./modules/team/team.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv
    }),
    DatabaseModule,
    AuthModule,
    AuditLogModule,
    BusinessProfileModule,
    CustomersModule,
    DashboardModule,
    ExportsModule,
    InvoicesModule,
    PaymentSetupModule,
    PaymentsModule,
    ReceiptsModule,
    TeamModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
