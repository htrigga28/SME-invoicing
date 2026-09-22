import {
  BadGatewayException,
  Inject,
  Injectable,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

import type {
  EmailProvider,
  SendEmailInput,
  SendEmailResult
} from "./email-provider";
import { EmailIdempotencyConflictError, EmailUncertainError } from "./email-provider";

/**
 * Resend tag carrying the Lumina communication id. Resend echoes tags on
 * webhook events, which is how inbound events correlate back to the exact
 * communication row without trusting any tenant claim in the payload.
 * Tag values accept UUIDs (ASCII letters, digits, dashes).
 */
export const RESEND_COMMUNICATION_TAG = "lumina_communication";

type ResendSendError = {
  message?: unknown;
  name?: unknown;
  statusCode?: unknown;
};

function formatAddress(email: string, name?: string | null): string {
  return name ? `${name} <${email}>` : email;
}

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend" as const;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.configService.get<string>("RESEND_API_KEY") &&
        this.configService.get<string>("RESEND_FROM_EMAIL")
    );
  }

  getFromEmail(): string | undefined {
    return this.configService.get<string>("RESEND_FROM_EMAIL");
  }

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    const apiKey = this.configService.get<string>("RESEND_API_KEY");

    if (!apiKey) {
      throw new ServiceUnavailableException("Email delivery is not configured.");
    }

    const timeoutMs = this.configService.get<number>("RESEND_REQUEST_TIMEOUT_MS") ?? 15000;
    const client = new Resend(apiKey);
    const send = client.emails.send(
      {
        from: formatAddress(input.fromEmail, input.fromName),
        to: input.to.map((recipient) => formatAddress(recipient.email, recipient.name)),
        cc: input.cc.map((recipient) => formatAddress(recipient.email, recipient.name)),
        ...(input.replyToEmail ? { replyTo: input.replyToEmail } : {}),
        subject: input.subject,
        html: input.htmlContent,
        text: input.textContent,
        tags: [
          { name: input.tags[0] ?? "invoice_delivery", value: input.tags[0] ?? "invoice_delivery" },
          { name: RESEND_COMMUNICATION_TAG, value: input.correlationId }
        ]
      },
      ...(input.idempotencyKey ? [{ idempotencyKey: input.idempotencyKey }] : [])
    );

    let response: Awaited<typeof send>;

    try {
      response = await this.withTimeout(send, timeoutMs);
    } catch (error) {
      if (error instanceof EmailUncertainError) {
        throw error;
      }

      throw new EmailUncertainError(
        "The email provider could not be reached. The email may still have been sent."
      );
    }

    const { data, error } = response;

    if (error) {
      const rawStatus = (error as ResendSendError).statusCode;
      const statusCode = typeof rawStatus === "number" ? rawStatus : null;
      const code = (error as ResendSendError).name;

      if (statusCode === 409) {
        // A concurrent identical request is explicitly retryable later.
        if (code === "concurrent_idempotent_requests") {
          throw new EmailUncertainError(
            "The email provider is already processing this delivery. Retry later with the same key."
          );
        }

        // Same key with a different payload is a local invariant violation.
        // The original request may still deliver, so this is conflict, never
        // proof of failure.
        throw new EmailIdempotencyConflictError();
      }

      // A 5xx from Resend cannot prove the email was not accepted.
      if (statusCode === null || statusCode >= 500) {
        throw new EmailUncertainError(
          "The email provider returned an error without confirming the outcome. The email may still have been sent."
        );
      }

      if (statusCode === 401 || statusCode === 403) {
        throw new BadGatewayException("Email provider rejected the request.");
      }

      if (statusCode === 429) {
        throw new BadGatewayException("Email provider rate limit reached. Please try again later.");
      }

      throw new BadGatewayException("Email provider could not send the message.");
    }

    if (!data?.id) {
      throw new EmailUncertainError(
        "The email provider did not return a message identifier. The email may still have been sent."
      );
    }

    return { providerMessageId: data.id };
  }

  /**
   * The Resend SDK exposes no per-request timeout. Race the send against a
   * timer and treat expiry as ambiguous: the request may still complete
   * provider-side, so callers must reuse the idempotency key on retry.
   * Promise.race subscribes to the send, so a late rejection is observed.
   */
  private async withTimeout<T>(send: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        send,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new EmailUncertainError(
                  "The email provider timed out without confirming receipt. The email may still have been sent."
                )
              ),
            Math.max(1000, timeoutMs)
          );
        })
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}
