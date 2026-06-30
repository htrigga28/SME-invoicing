import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Post,
  Req
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { PaymentsService } from "./payments.service";

type RawBodyRequest = {
  rawBody?: Buffer;
};

@ApiTags("Payments")
@Controller("payments")
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly paymentsService: PaymentsService) {}

  @Post("paystack/webhook")
  @HttpCode(200)
  @ApiOperation({ summary: "Process Paystack webhook events" })
  processPaystackWebhook(
    @Req() request: RawBodyRequest,
    @Headers("x-paystack-signature") signatureHeader?: string | string[]
  ) {
    if (!request.rawBody) {
      throw new BadRequestException("Raw webhook body is unavailable.");
    }

    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    return this.paymentsService.processPaystackWebhook(request.rawBody, signature);
  }
}
