import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { PaystackService } from "./paystack.service";

@Module({
  imports: [ConfigModule],
  providers: [PaystackService],
  exports: [PaystackService]
})
export class PaystackModule {}
