import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../database/database.module";
import { AuthRepository } from "../auth/auth.repository";
import { TenantContextService } from "./tenant-context.service";

@Module({
  imports: [DatabaseModule],
  providers: [AuthRepository, TenantContextService],
  exports: [TenantContextService]
})
export class TenantModule {}
