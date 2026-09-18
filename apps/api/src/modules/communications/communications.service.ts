import { timingSafeEqual } from "crypto";
import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, desc, eq, sql } from "drizzle-orm";

import { DatabaseService } from "../../database/database.service";
import {
  communicationEvents,
  communications,
  invoices,
  invoiceViewEvents,
  type Communication,
  type Invoice
} from "../../database/schema";
import { AuditLogService } from "../audit-log/audit-log.service";
import { BrevoEmailProvider } from "./brevo-email.provider";
import {
  buildInvoiceEmailHtml,
  buildInvoiceEmailText,
  defaultInvoiceEmailSubject,
  validateSendRecipients
} from "./email-provider";

export type CommunicationStatus = Communication["status"];

export type DeliveryState =
  | "not_emailed"
  | "sending"
  | "accepted"
  | "delivered"
  | "delayed"
  | "failed";

export type SendInvoiceEmailInput = {
  customerEmail: string;
  customerName: string;
  businessName: string;
  businessEmail?: string | null | undefined;
  invoiceNumber: string;
  amountDueKobo: number;
  dueDate: string;
  publicUrl: string;
  to: string[];
  cc?: string[] | undefined;
  subject?: string | undefined;
};

export type BrevoWebhookPayload = {
  event?: unknown;
  email?: unknown;
  "message-id"?: unknown;
  messageId?: unknown;
  message_id?: unknown;
  ts?: unknown;
  ts_event?: unknown;
  subject?: unknown;
};

type MappedBrevoEvent = {
  outcome: "accepted" | "delivered" | "deferred" | "failed" | "ignored";
  eventType: string;
};

const STATUS_RANK: Record<CommunicationStatus, number> = {
  pending: 0,
  accepted: 1,
  deferred: 2,
  delivered: 3,
  failed: 3
};

const FAILURE_REASONS: Record<string, string> = {
  hard_bounce: "The email address bounced. Check the recipient and try again.",
  blocked: "The email was blocked by the email provider.",
  invalid: "A recipient address was rejected as invalid.",
  error: "The email provider reported an error."
};

export function mapBrevoEventType(rawEvent: string): MappedBrevoEvent {
  const normalized = rawEvent.trim().toLowerCase().replace(/[\s-]+/g, "_");

  switch (normalized) {
    case "request":
    case "sent":
      return { outcome: "accepted", eventType: normalized };
    case "delivered":
    case "delivery":
      return { outcome: "delivered", eventType: "delivered" };
    case "deferred":
    case "soft_bounce":
    case "softbounce":
      return { outcome: "deferred", eventType: normalized };
    case "hard_bounce":
    case "hardbounce":
    case "blocked":
    case "invalid":
    case "error":
      return { outcome: "failed", eventType: normalized };
    default:
      return { outcome: "ignored", eventType: normalized || "unknown" };
  }
}

export function toDeliveryState(status: CommunicationStatus | null): DeliveryState {
  switch (status) {
    case "accepted":
      return "accepted";
    case "delivered":
      return "delivered";
    case "deferred":
      return "delayed";
    case "failed":
      return "failed";
    case "pending":
      return "sending";
    default:
      return "not_emailed";
  }
}

@Injectable()
export class CommunicationsService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(BrevoEmailProvider) private readonly brevoEmailProvider: BrevoEmailProvider,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService
  ) {}

  async sendInvoiceEmail(input: {
    organisationId: string;
    userId: string;
    invoice: Pick<Invoice, "id" | "invoiceNumber">;
    customerId: string;
    content: SendInvoiceEmailInput;
  }): Promise<{ communication: Communication }> {
    let recipients: { to: string[]; cc: string[] };

    try {
      recipients = validateSendRecipients(input.content.to, input.content.cc ?? []);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Recipients are invalid."
      );
    }

    if (!this.brevoEmailProvider.isConfigured()) {
      throw new ServiceUnavailableException(
        "Email delivery is not configured. The invoice is issued and the public link can still be shared."
      );
    }

    const subject =
      input.content.subject?.trim() ||
      defaultInvoiceEmailSubject(input.content.invoiceNumber, input.content.businessName);
    const htmlContent = buildInvoiceEmailHtml({
      businessName: input.content.businessName,
      customerName: input.content.customerName,
      invoiceNumber: input.content.invoiceNumber,
      amountDueKobo: input.content.amountDueKobo,
      currency: "NGN",
      dueDate: input.content.dueDate,
      publicUrl: input.content.publicUrl
    });
    const textContent = buildInvoiceEmailText({
      businessName: input.content.businessName,
      customerName: input.content.customerName,
      invoiceNumber: input.content.invoiceNumber,
      amountDueKobo: input.content.amountDueKobo,
      currency: "NGN",
      dueDate: input.content.dueDate,
      publicUrl: input.content.publicUrl
    });

    const [communication] = await this.databaseService.db
      .insert(communications)
      .values({
        organisationId: input.organisationId,
        invoiceId: input.invoice.id,
        customerId: input.customerId,
        purpose: "invoice_delivery",
        channel: "email",
        provider: "brevo",
        subject,
        toRecipients: recipients.to,
        ccRecipients: recipients.cc,
        status: "pending",
        createdByUserId: input.userId
      })
      .returning();

    if (!communication) {
      throw new Error("Communication record could not be created.");
    }

    try {
      const result = await this.brevoEmailProvider.sendEmail({
        fromEmail: this.brevoEmailProvider.getFromEmail()!,
        fromName: `${input.content.businessName} via Lumina`,
        replyToEmail: input.content.businessEmail,
        to: recipients.to.map((email) => ({
          email,
          name: email === recipients.to[0] ? input.content.customerName : null
        })),
        cc: recipients.cc.map((email) => ({ email })),
        subject,
        htmlContent,
        textContent,
        tags: ["invoice_delivery", input.content.invoiceNumber]
      });

      const [accepted] = await this.databaseService.db
        .update(communications)
        .set({
          providerMessageId: result.providerMessageId,
          status: "accepted",
          acceptedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(communications.id, communication.id))
        .returning();

      await this.auditLogService.create({
        organisationId: input.organisationId,
        actorUserId: input.userId,
        action: "invoice_email_sent",
        entityType: "invoice",
        entityId: input.invoice.id,
        metadataRedacted: {
          invoiceNumber: input.content.invoiceNumber,
          communicationId: communication.id,
          recipientCount: recipients.to.length + recipients.cc.length
        }
      });

      return { communication: accepted ?? communication };
    } catch (error) {
      const failureReason =
        error instanceof Error && error.message
          ? error.message.slice(0, 300)
          : "Email provider could not send the message.";

      await this.databaseService.db
        .update(communications)
        .set({ status: "failed", failedAt: new Date(), failureReason, updatedAt: new Date() })
        .where(eq(communications.id, communication.id));

      await this.auditLogService.create({
        organisationId: input.organisationId,
        actorUserId: input.userId,
        action: "invoice_email_failed",
        entityType: "invoice",
        entityId: input.invoice.id,
        metadataRedacted: {
          invoiceNumber: input.content.invoiceNumber,
          communicationId: communication.id,
          failureReason
        }
      });

      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException ||
        error instanceof BadGatewayException
      ) {
        throw error;
      }

      throw new BadGatewayException("Email provider could not send the message.");
    }
  }

  async recordInvoiceViewEvent(
    organisationId: string,
    invoiceId: string
  ): Promise<{ occurredAt: Date; viewCount: number }> {
    const occurredAt = new Date();

    await this.databaseService.db.insert(invoiceViewEvents).values({
      organisationId,
      invoiceId,
      occurredAt,
      source: "public_invoice_page"
    });

    const [updated] = await this.databaseService.db
      .update(invoices)
      .set({
        lastViewedAt: occurredAt,
        viewCount: sql`${invoices.viewCount} + 1`,
        updatedAt: occurredAt
      })
      .where(eq(invoices.id, invoiceId))
      .returning({ viewCount: invoices.viewCount });

    return { occurredAt, viewCount: updated?.viewCount ?? 1 };
  }

  async processBrevoWebhook(
    secretHeader: string | undefined,
    payload: BrevoWebhookPayload
  ): Promise<{ received: true; duplicate?: boolean; ignored?: boolean; unknown?: boolean }> {
    this.assertWebhookSecret(secretHeader);

    const messageId = this.readMessageId(payload);
    const rawEvent = typeof payload.event === "string" ? payload.event : "";
    const mapped = mapBrevoEventType(rawEvent);

    if (!messageId) {
      return { received: true, ignored: true };
    }

    const communication = await this.findCommunicationByMessageId(messageId);

    if (!communication) {
      return { received: true, unknown: true };
    }

    const occurredAt = this.readOccurredAt(payload);
    const providerEventKey = `${messageId}::${mapped.eventType}::${Math.floor(occurredAt.getTime() / 1000)}`;
    const email = typeof payload.email === "string" ? payload.email : null;

    const inserted = await this.databaseService.db
      .insert(communicationEvents)
      .values({
        organisationId: communication.organisationId,
        communicationId: communication.id,
        invoiceId: communication.invoiceId,
        provider: "brevo",
        providerEventKey,
        eventType: mapped.eventType,
        occurredAt,
        metadataRedacted: email ? { email } : null
      })
      .onConflictDoNothing({ target: communicationEvents.providerEventKey })
      .returning({ id: communicationEvents.id });

    if (inserted.length === 0) {
      return { received: true, duplicate: true };
    }

    if (mapped.outcome !== "ignored") {
      await this.applyDeliveryOutcome(communication, mapped);
    }

    return { received: true };
  }

  async getDeliverySummary(organisationId: string, invoiceId: string) {
    const rows = await this.databaseService.db
      .select()
      .from(communications)
      .where(
        and(
          eq(communications.organisationId, organisationId),
          eq(communications.invoiceId, invoiceId)
        )
      )
      .orderBy(desc(communications.createdAt))
      .limit(10);

    const latest = rows[0] ?? null;

    return {
      state: toDeliveryState(latest?.status ?? null),
      attempts: rows.length,
      lastCommunication: latest ? this.toSafeCommunication(latest) : null
    };
  }

  async listCommunicationsForInvoice(organisationId: string, invoiceId: string) {
    const rows = await this.databaseService.db
      .select()
      .from(communications)
      .where(
        and(
          eq(communications.organisationId, organisationId),
          eq(communications.invoiceId, invoiceId)
        )
      )
      .orderBy(desc(communications.createdAt));

    const events =
      rows.length === 0
        ? []
        : await this.databaseService.db
            .select()
            .from(communicationEvents)
            .where(
              and(
                eq(communicationEvents.organisationId, organisationId),
                eq(communicationEvents.invoiceId, invoiceId)
              )
            )
            .orderBy(desc(communicationEvents.occurredAt));

    return { communications: rows.map((row) => this.toSafeCommunication(row)), events };
  }

  async listViewEventsForInvoice(organisationId: string, invoiceId: string) {
    return this.databaseService.db
      .select()
      .from(invoiceViewEvents)
      .where(
        and(
          eq(invoiceViewEvents.organisationId, organisationId),
          eq(invoiceViewEvents.invoiceId, invoiceId)
        )
      )
      .orderBy(desc(invoiceViewEvents.occurredAt));
  }

  toSafeCommunication(communication: Communication) {
    return {
      id: communication.id,
      purpose: communication.purpose,
      channel: communication.channel,
      provider: communication.provider,
      subject: communication.subject,
      toRecipients: communication.toRecipients,
      ccRecipients: communication.ccRecipients,
      status: communication.status,
      acceptedAt: communication.acceptedAt,
      deliveredAt: communication.deliveredAt,
      deferredAt: communication.deferredAt,
      failedAt: communication.failedAt,
      failureReason: communication.failureReason,
      createdAt: communication.createdAt,
      updatedAt: communication.updatedAt
    };
  }

  private async applyDeliveryOutcome(
    communication: Communication,
    mapped: MappedBrevoEvent
  ): Promise<void> {
    const nextStatus =
      mapped.outcome === "accepted"
        ? "accepted"
        : mapped.outcome === "delivered"
          ? "delivered"
          : mapped.outcome === "deferred"
            ? "deferred"
            : "failed";

    if (STATUS_RANK[nextStatus] <= STATUS_RANK[communication.status]) {
      return;
    }

    const now = new Date();
    const patch: Partial<Communication> = { status: nextStatus, updatedAt: now };

    if (nextStatus === "accepted") {
      patch.acceptedAt = now;
    } else if (nextStatus === "delivered") {
      patch.deliveredAt = now;
    } else if (nextStatus === "deferred") {
      patch.deferredAt = now;
    } else {
      patch.failedAt = now;
      patch.failureReason =
        FAILURE_REASONS[mapped.eventType] ?? "The email provider reported a delivery failure.";
    }

    await this.databaseService.db
      .update(communications)
      .set(patch)
      .where(eq(communications.id, communication.id));

    if (nextStatus === "delivered" || nextStatus === "failed") {
      await this.auditLogService.create({
        organisationId: communication.organisationId,
        actorUserId: null,
        action: nextStatus === "delivered" ? "invoice_email_delivered" : "invoice_email_failed",
        entityType: "invoice",
        entityId: communication.invoiceId,
        metadataRedacted: {
          communicationId: communication.id,
          eventType: mapped.eventType
        }
      });
    }
  }

  private async findCommunicationByMessageId(messageId: string) {
    const [row] = await this.databaseService.db
      .select()
      .from(communications)
      .where(eq(communications.providerMessageId, messageId))
      .limit(1);

    return row ?? null;
  }

  private readMessageId(payload: BrevoWebhookPayload): string | null {
    const candidates = [payload["message-id"], payload.messageId, payload.message_id];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }

    return null;
  }

  private readOccurredAt(payload: BrevoWebhookPayload): Date {
    const candidates = [payload.ts_event, payload.ts];

    for (const candidate of candidates) {
      const seconds = typeof candidate === "string" ? Number(candidate) : candidate;

      if (typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0) {
        return new Date(seconds * 1000);
      }
    }

    return new Date();
  }

  private assertWebhookSecret(secretHeader: string | undefined): void {
    const expected = this.configService.get<string>("BREVO_WEBHOOK_SECRET");

    if (!expected) {
      throw new UnauthorizedException("Email webhook is not configured.");
    }

    const received = Buffer.from(secretHeader ?? "");
    const expectedBuffer = Buffer.from(expected);

    if (received.length !== expectedBuffer.length || !timingSafeEqual(received, expectedBuffer)) {
      throw new UnauthorizedException("Invalid webhook secret.");
    }
  }
}
