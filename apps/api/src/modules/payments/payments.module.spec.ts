import "reflect-metadata";

import { MODULE_METADATA } from "@nestjs/common/constants";

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AuthRepository } from "../auth/auth.repository";
import { TokenService } from "../auth/token.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { PaymentsModule } from "./payments.module";

describe("PaymentsModule", () => {
  it("registers auth and tenant providers required by guarded payment read routes", () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, PaymentsModule);

    expect(providers).toEqual(
      expect.arrayContaining([
        AuthRepository,
        JwtAuthGuard,
        RolesGuard,
        TenantContextService,
        TokenService
      ])
    );
  });
});
