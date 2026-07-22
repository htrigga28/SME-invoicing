import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../database/database.module";
import { PublicWaitlistController } from "./public-waitlist.controller";
import { PublicWaitlistService } from "./public-waitlist.service";

@Module({
  imports: [DatabaseModule],
  controllers: [PublicWaitlistController],
  providers: [PublicWaitlistService]
})
export class PublicWaitlistModule {}
