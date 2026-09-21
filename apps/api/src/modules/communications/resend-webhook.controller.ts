import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Post,
  Req
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import type { ResendWebhookPayload } from "./communications.service";
import { CommunicationsService } from "./communications.service";

type RawBodyRequest = {
  rawBody?: Buffer;
};

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

@ApiTags("Webhooks")
@Controller("webhooks/resend")
export class ResendWebhookController {
  constructor(
    @Inject(CommunicationsService) private readonly communicationsService: CommunicationsService
  ) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: "Process Resend email events" })
  processResendWebhook(
    @Req() request: RawBodyRequest,
    @Headers("svix-id") svixId?: string | string[],
    @Headers("svix-timestamp") svixTimestamp?: string | string[],
    @Headers("svix-signature") svixSignature?: string | string[],
    @Body() payload?: ResendWebhookPayload
  ) {
    if (!request.rawBody) {
      throw new BadRequestException("Raw webhook body is unavailable.");
    }

    return this.communicationsService.processResendWebhook({
      headers: {
        svixId: firstHeader(svixId),
        svixTimestamp: firstHeader(svixTimestamp),
        svixSignature: firstHeader(svixSignature)
      },
      rawBody: request.rawBody,
      payload: payload ?? {}
    });
  }
}
