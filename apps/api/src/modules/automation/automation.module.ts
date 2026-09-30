import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { DatabaseModule } from "../../database/database.module";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { AuthRepository } from "../auth/auth.repository";
import { TokenService } from "../auth/token.service";
import { CommunicationsModule } from "../communications/communications.module";
import { TenantContextService } from "../tenant/tenant-context.service";
import { AutomationRunnerService } from "./automation-runner.service";
import { InternalAutomationController } from "./internal-automation.controller";
import { RecurringInvoicesController } from "./recurring-invoices.controller";
import { RecurringInvoicesService } from "./recurring-invoices.service";
import { ReminderSettingsController } from "./reminder-settings.controller";
import { ReminderSettingsService } from "./reminder-settings.service";
import { ScheduledSendService } from "./scheduled-send.service";

@Module({
  imports: [ConfigModule, DatabaseModule, AuditLogModule, CommunicationsModule],
  controllers: [RecurringInvoicesController, ReminderSettingsController, InternalAutomationController],
  providers: [
    AuthRepository,
    AutomationRunnerService,
    JwtAuthGuard,
    RecurringInvoicesService,
    ReminderSettingsService,
    RolesGuard,
    ScheduledSendService,
    TenantContextService,
    TokenService
  ],
  exports: [AutomationRunnerService, RecurringInvoicesService, ReminderSettingsService, ScheduledSendService]
})
export class AutomationModule {}


