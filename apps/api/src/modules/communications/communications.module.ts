import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { DatabaseModule } from "../../database/database.module";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { CommunicationsService } from "./communications.service";
import { ResendEmailProvider } from "./resend-email.provider";
import { ResendWebhookController } from "./resend-webhook.controller";

@Module({
  imports: [ConfigModule, DatabaseModule, AuditLogModule],
  controllers: [ResendWebhookController],
  providers: [ResendEmailProvider, CommunicationsService],
  exports: [CommunicationsService]
})
export class CommunicationsModule {}
