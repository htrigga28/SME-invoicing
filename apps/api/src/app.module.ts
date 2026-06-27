import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { validateEnv } from "./config/env.validation";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health.controller";
import { AuthModule } from "./modules/auth/auth.module";
import { BusinessProfileModule } from "./modules/business-profile/business-profile.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv
    }),
    DatabaseModule,
    AuthModule,
    BusinessProfileModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
