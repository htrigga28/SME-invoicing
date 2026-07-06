import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { DatabaseModule } from "../../database/database.module";
import { AuthRepository } from "../auth/auth.repository";
import { TokenService } from "../auth/token.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { PublicReceiptsController, ReceiptsController } from "./receipts.controller";
import { ReceiptsService } from "./receipts.service";

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [ReceiptsController, PublicReceiptsController],
  providers: [
    AuthRepository,
    JwtAuthGuard,
    ReceiptsService,
    RolesGuard,
    TenantContextService,
    TokenService
  ],
  exports: [ReceiptsService]
})
export class ReceiptsModule {}
