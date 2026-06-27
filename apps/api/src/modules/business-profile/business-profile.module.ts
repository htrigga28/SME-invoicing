import { Module } from "@nestjs/common";

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { DatabaseModule } from "../../database/database.module";
import { AuthRepository } from "../auth/auth.repository";
import { TokenService } from "../auth/token.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { BusinessProfileController } from "./business-profile.controller";
import { BusinessProfileService } from "./business-profile.service";

@Module({
  imports: [DatabaseModule],
  controllers: [BusinessProfileController],
  providers: [
    AuthRepository,
    BusinessProfileService,
    JwtAuthGuard,
    RolesGuard,
    TenantContextService,
    TokenService
  ]
})
export class BusinessProfileModule {}
