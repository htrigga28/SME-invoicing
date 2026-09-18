import {
  BadGatewayException,
  Inject,
  Injectable,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EmailProvider, SendEmailInput, SendEmailResult } from "./email-provider";

type BrevoSendResponse = {
  messageId?: unknown;
};

@Injectable()
export class BrevoEmailProvider implements EmailProvider {
  readonly name = "brevo" as const;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.configService.get<string>("BREVO_API_KEY") && this.configService.get<string>("BREVO_FROM_EMAIL")
    );
  }

  getFromEmail(): string | undefined {
    return this.configService.get<string>("BREVO_FROM_EMAIL");
  }

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    const apiKey = this.configService.get<string>("BREVO_API_KEY");

    if (!apiKey) {
      throw new ServiceUnavailableException("Email delivery is not configured.");
    }

    const baseUrl =
      this.configService.get<string>("BREVO_BASE_URL") ?? "https://api.brevo.com";
    let response: Response;

    try {
      response = await fetch(new URL("/v3/smtp/email", baseUrl), {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          sender: { email: input.fromEmail, name: input.fromName },
          to: input.to.map((recipient) => ({
            email: recipient.email,
            ...(recipient.name ? { name: recipient.name } : {})
          })),
          ...(input.cc.length
            ? {
                cc: input.cc.map((recipient) => ({
                  email: recipient.email,
                  ...(recipient.name ? { name: recipient.name } : {})
                }))
              }
            : {}),
          ...(input.replyToEmail ? { replyTo: { email: input.replyToEmail } } : {}),
          subject: input.subject,
          htmlContent: input.htmlContent,
          textContent: input.textContent,
          tags: input.tags
        })
      });
    } catch {
      throw new BadGatewayException("Email provider could not be reached. Please try again later.");
    }

    if (response.status === 401 || response.status === 403) {
      throw new BadGatewayException("Email provider rejected the request.");
    }

    if (response.status === 429) {
      throw new BadGatewayException("Email provider rate limit reached. Please try again later.");
    }

    if (!response.ok) {
      throw new BadGatewayException("Email provider could not send the message.");
    }

    let payload: BrevoSendResponse;

    try {
      payload = (await response.json()) as BrevoSendResponse;
    } catch {
      throw new BadGatewayException("Email provider returned an unreadable response.");
    }

    if (typeof payload.messageId !== "string" || !payload.messageId) {
      throw new BadGatewayException("Email provider did not return a message identifier.");
    }

    return { providerMessageId: payload.messageId };
  }
}
