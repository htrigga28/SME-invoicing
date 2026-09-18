import { Body, Controller, Headers, HttpCode, Inject, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import type { BrevoWebhookPayload } from "./communications.service";
import { CommunicationsService } from "./communications.service";

@ApiTags("Webhooks")
@Controller("webhooks/brevo")
export class BrevoWebhookController {
  constructor(
    @Inject(CommunicationsService) private readonly communicationsService: CommunicationsService
  ) {}

  @Post("transactional")
  @HttpCode(200)
  @ApiOperation({ summary: "Process Brevo transactional email events" })
  processTransactionalWebhook(
    @Headers("x-brevo-webhook-secret") secretHeader?: string | string[],
    @Body() payload?: BrevoWebhookPayload
  ) {
    const secret = Array.isArray(secretHeader) ? secretHeader[0] : secretHeader;
    return this.communicationsService.processBrevoWebhook(secret, payload ?? {});
  }
}
