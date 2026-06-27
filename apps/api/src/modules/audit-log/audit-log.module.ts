import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../database/database.module";
import { AuthRepository } from "../auth/auth.repository";
import { AuditLogService } from "./audit-log.service";

@Module({
  imports: [DatabaseModule],
  providers: [AuditLogService, AuthRepository],
  exports: [AuditLogService]
})
export class AuditLogModule {}
