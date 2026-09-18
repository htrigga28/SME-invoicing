import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { DatabaseModule } from "../../database/database.module";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { BrevoEmailProvider } from "./brevo-email.provider";
import { BrevoWebhookController } from "./brevo-webhook.controller";
import { CommunicationsService } from "./communications.service";

@Module({
  imports: [ConfigModule, DatabaseModule, AuditLogModule],
  controllers: [BrevoWebhookController],
  providers: [BrevoEmailProvider, CommunicationsService],
  exports: [CommunicationsService]
})
export class CommunicationsModule {}
