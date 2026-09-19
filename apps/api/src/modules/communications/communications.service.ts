import { randomUUID, timingSafeEqual } from "crypto";
import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, count, desc, eq, sql } from "drizzle-orm";

import { DatabaseService } from "../../database/database.service";
import {
  communicationEvents,
  communicationRecipients,
  communications,
  invoices,
  invoiceViewEvents,
  type Communication,
  type CommunicationRecipient,
  type Invoice
} from "../../database/schema";
import { AuditLogService } from "../audit-log/audit-log.service";
import { BrevoEmailProvider } from "./brevo-email.provider";
import {
  buildInvoiceEmailHtml,
  buildInvoiceEmailText,
  defaultInvoiceEmailSubject,
  EmailUncertainError,
  validateSendRecipients
} from "./email-provider";

export type CommunicationStatus = Communication["status"];
export type RecipientStatus = CommunicationRecipient["status"];

export type DeliveryState =
  | "not_emailed"
  | "sending"
  | "accepted"
  | "delivered"
  | "delayed"
  | "failed"
  | "uncertain"
  | "in_progress"
  | "partially_failed";

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
  submission_uncertain: 1,
  accepted: 2,
  deferred: 3,
  delivered: 4,
  failed: 4,
  in_progress: 2,
  partially_failed: 4
};

/**
 * Valid predecessors for a recipient-level transition. The database checks
 * the current row state inside the UPDATE itself, so concurrent webhook
 * deliveries cannot regress a recipient that another request just advanced.
 */
const RECIPIENT_PREDECESSORS: Record<RecipientStatus, RecipientStatus[]> = {
  pending: [],
  accepted: ["pending"],
  deferred: ["pending", "accepted"],
  delivered: ["pending", "accepted", "deferred"],
  failed: ["pending", "accepted", "deferred"]
};

const FAILURE_REASONS: Record<string, string> = {
  hard_bounce: "The email address bounced. Check the recipient and try again.",
  blocked: "The email was blocked by the email provider.",
  invalid: "A recipient address was rejected as invalid.",
  invalid_email: "A recipient address was rejected as invalid.",
  error: "The email provider reported an error."
};

/**
 * Derives the parent communication state from its recipient states.
 * Single-recipient sends collapse back to the plain lifecycle states; only
 * genuinely mixed multi-recipient outcomes surface aggregate states.
 */
export function aggregateRecipientStatuses(statuses: RecipientStatus[]): CommunicationStatus {
  if (statuses.length === 0) {
    return "pending";
  }

  if (statuses.every((status) => status === "accepted")) {
    return "accepted";
  }

  if (statuses.every((status) => status === "delivered")) {
    return "delivered";
  }

  if (statuses.every((status) => status === "failed")) {
    return "failed";
  }

  if (statuses.some((status) => status === "failed")) {
    return "partially_failed";
  }

  if (statuses.some((status) => status === "deferred")) {
    return "deferred";
  }

  return "in_progress";
}

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
    case "invalid_email":
    case "error":
      return { outcome: "failed", eventType: normalized };
    default:
      return { outcome: "ignored", eventType: normalized || "unknown" };
  }
}

function maxTimestamp(values: (Date | null)[]): Date | null {
  let latest: Date | null = null;

  for (const value of values) {
    if (value && (!latest || value.getTime() > latest.getTime())) {
      latest = value;
    }
  }

  return latest;
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
    case "submission_uncertain":
      return "uncertain";
    case "in_progress":
      return "in_progress";
    case "partially_failed":
      return "partially_failed";
    case "pending":
      return "sending";
    default:
      return "not_emailed";
  }
}

@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);

  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(BrevoEmailProvider) private readonly brevoEmailProvider: BrevoEmailProvider,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService
  ) {}

  async sendInvoiceEmail(
    input: {
      organisationId: string;
      userId: string;
      invoice: Pick<Invoice, "id" | "invoiceNumber">;
      customerId: string;
      content: SendInvoiceEmailInput;
    },
    options?: { idempotencyKey?: string }
  ): Promise<{ communication: Communication; outcome: "accepted" | "uncertain" }> {
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
    const idempotencyKey = options?.idempotencyKey ?? randomUUID();

    const communication = await this.databaseService.db.transaction(async (tx) => {
      const [created] = await tx
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
          providerIdempotencyKey: idempotencyKey,
          status: "pending",
          createdByUserId: input.userId
        })
        .returning();

      if (!created) {
        throw new Error("Communication record could not be created.");
      }

      await tx.insert(communicationRecipients).values([
        ...recipients.to.map((email) => ({
          organisationId: input.organisationId,
          communicationId: created.id,
          invoiceId: input.invoice.id,
          email,
          recipientType: "to",
          status: "pending" as RecipientStatus
        })),
        ...recipients.cc.map((email) => ({
          organisationId: input.organisationId,
          communicationId: created.id,
          invoiceId: input.invoice.id,
          email,
          recipientType: "cc",
          status: "pending" as RecipientStatus
        }))
      ]);

      return created;
    });

    // Provider boundary: only an explicit provider rejection may mark the
    // attempt failed. Anything ambiguous (transport/timeout/5xx/unreadable)
    // is recorded as uncertain so a later retry cannot silently duplicate mail.
    let providerMessageId: string;

    try {
      ({ providerMessageId } = await this.brevoEmailProvider.sendEmail({
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
        tags: ["invoice_delivery", input.content.invoiceNumber],
        idempotencyKey
      }));
    } catch (error) {
      if (error instanceof EmailUncertainError) {
        const [uncertain] = await this.databaseService.db
          .update(communications)
          .set({
            status: "submission_uncertain",
            failureReason: error.message.slice(0, 300),
            updatedAt: new Date()
          })
          .where(eq(communications.id, communication.id))
          .returning();

        return { communication: uncertain ?? communication, outcome: "uncertain" as const };
      }

      await this.databaseService.db
        .update(communications)
        .set({
          status: "failed",
          failedAt: new Date(),
          failureReason:
            error instanceof Error && error.message
              ? error.message.slice(0, 300)
              : "Email provider could not send the message.",
          updatedAt: new Date()
        })
        .where(eq(communications.id, communication.id));
      await this.databaseService.db
        .update(communicationRecipients)
        .set({ status: "failed", failedAt: new Date(), updatedAt: new Date() })
        .where(eq(communicationRecipients.communicationId, communication.id));

      await this.auditSafely({
        organisationId: input.organisationId,
        actorUserId: input.userId,
        action: "invoice_email_failed",
        entityType: "invoice",
        entityId: input.invoice.id,
        metadataRedacted: {
          invoiceNumber: input.content.invoiceNumber,
          communicationId: communication.id
        }
      });

      if (error instanceof HttpException) {
        throw error;
      }

      throw new BadGatewayException("Email provider could not send the message.");
    }

    // Persistence boundary: the provider has accepted the message, so this
    // block must never rewrite the attempt as failed. If Lumina cannot save
    // the confirmation, surface a 500 and leave the row pending/accepted so
    // a later provider webhook can still advance it.
    const acceptedAt = new Date();
    let accepted: Communication;

    try {
      const [updated] = await this.databaseService.db
        .update(communications)
        .set({
          providerMessageId,
          status: "accepted",
          acceptedAt,
          updatedAt: acceptedAt
        })
        .where(eq(communications.id, communication.id))
        .returning();

      if (!updated) {
        throw new Error("Accepted communication could not be saved.");
      }

      await this.databaseService.db
        .update(communicationRecipients)
        .set({ status: "accepted", acceptedAt, updatedAt: acceptedAt })
        .where(eq(communicationRecipients.communicationId, communication.id));

      accepted = updated;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException(
        "The email provider accepted the message, but Lumina could not save the confirmation. Check the activity timeline before resending."
      );
    }

    await this.auditSafely({
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

    return { communication: accepted, outcome: "accepted" as const };
  }

  /**
   * Starts a distinct resend attempt. When the latest attempt for the invoice
   * is still submission-uncertain, the new attempt reuses its idempotency key
   * so a provider-side retry of the same logical send cannot duplicate mail.
   */
  async resendInvoiceEmail(input: {
    organisationId: string;
    userId: string;
    invoice: Pick<Invoice, "id" | "invoiceNumber">;
    customerId: string;
    content: SendInvoiceEmailInput;
  }): Promise<{ communication: Communication; outcome: "accepted" | "uncertain" }> {
    const latest = await this.findLatestCommunication(input.organisationId, input.invoice.id);
    const reuseKey =
      latest?.status === "submission_uncertain" ? latest.providerIdempotencyKey : undefined;

    return this.sendInvoiceEmail(input, reuseKey ? { idempotencyKey: reuseKey } : undefined);
  }

  async findLatestCommunication(
    organisationId: string,
    invoiceId: string
  ): Promise<Communication | null> {
    const [row] = await this.databaseService.db
      .select()
      .from(communications)
      .where(
        and(
          eq(communications.organisationId, organisationId),
          eq(communications.invoiceId, invoiceId)
        )
      )
      .orderBy(desc(communications.createdAt))
      .limit(1);

    return row ?? null;
  }

  private async auditSafely(
    input: Parameters<AuditLogService["create"]>[0]
  ): Promise<void> {
    try {
      await this.auditLogService.create(input);
    } catch (error) {
      // Audit logging is observability, never authority: a logging failure
      // must not change delivery state or fail the request.
      this.logger.warn(
        `Audit log write failed for ${input.action}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async recordInvoiceViewEvent(
    organisationId: string,
    invoiceId: string
  ): Promise<{ occurredAt: Date; viewCount: number }> {
    const occurredAt = new Date();

    const viewCount = await this.databaseService.db.transaction(async (tx) => {
      await tx.insert(invoiceViewEvents).values({
        organisationId,
        invoiceId,
        occurredAt,
        source: "public_invoice_page"
      });

      const [updated] = await tx
        .update(invoices)
        .set({
          lastViewedAt: occurredAt,
          viewCount: sql`${invoices.viewCount} + 1`,
          viewedAt: sql`COALESCE(${invoices.viewedAt}, ${occurredAt})`,
          updatedAt: occurredAt
        })
        .where(and(eq(invoices.id, invoiceId), eq(invoices.organisationId, organisationId)))
        .returning({ viewCount: invoices.viewCount });

      if (!updated) {
        throw new Error("Invoice view summary could not be updated.");
      }

      return updated.viewCount;
    });

    return { occurredAt, viewCount };
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
    const email =
      typeof payload.email === "string" && payload.email.trim()
        ? payload.email.trim().toLowerCase()
        : null;
    const providerEventKey = [
      messageId,
      mapped.eventType,
      Math.floor(occurredAt.getTime() / 1000),
      email ?? "-"
    ].join("::");

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

    if (mapped.outcome === "ignored") {
      return { received: true };
    }

    if (email) {
      const recipient = await this.findCommunicationRecipient(communication.id, email);

      if (recipient) {
        const advanced = await this.tryAdvanceRecipient(recipient, mapped, occurredAt);

        if (advanced) {
          await this.refreshCommunicationAggregate(communication.id);
        }

        return { received: true };
      }
    }

    // Legacy fallback for events without a resolvable recipient row: advance
    // the parent with the same conditional-update protection.
    await this.tryAdvanceCommunication(communication, mapped, occurredAt);

    return { received: true };
  }

  async getDeliverySummary(organisationId: string, invoiceId: string) {
    const [latestRows, countRows] = await Promise.all([
      this.databaseService.db
        .select()
        .from(communications)
        .where(
          and(
            eq(communications.organisationId, organisationId),
            eq(communications.invoiceId, invoiceId)
          )
        )
        .orderBy(desc(communications.createdAt))
        .limit(1),
      this.databaseService.db
        .select({ total: count() })
        .from(communications)
        .where(
          and(
            eq(communications.organisationId, organisationId),
            eq(communications.invoiceId, invoiceId)
          )
        )
    ]);

    const latest = latestRows[0] ?? null;
    const recipients = latest ? await this.listRecipients(latest.id) : [];

    return {
      state: toDeliveryState(latest?.status ?? null),
      attempts: Number(countRows[0]?.total ?? 0),
      lastCommunication: latest ? this.toSafeCommunication(latest, recipients) : null
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

    const [events, allRecipients] = await Promise.all([
      rows.length === 0
        ? Promise.resolve([])
        : this.databaseService.db
            .select()
            .from(communicationEvents)
            .where(
              and(
                eq(communicationEvents.organisationId, organisationId),
                eq(communicationEvents.invoiceId, invoiceId)
              )
            )
            .orderBy(desc(communicationEvents.occurredAt)),
      rows.length === 0
        ? Promise.resolve([])
        : this.databaseService.db
            .select()
            .from(communicationRecipients)
            .where(
              and(
                eq(communicationRecipients.organisationId, organisationId),
                eq(communicationRecipients.invoiceId, invoiceId)
              )
            )
    ]);

    const recipientsByCommunicationId = new Map<string, CommunicationRecipient[]>();

    for (const recipient of allRecipients) {
      const current = recipientsByCommunicationId.get(recipient.communicationId) ?? [];
      current.push(recipient);
      recipientsByCommunicationId.set(recipient.communicationId, current);
    }

    return {
      communications: rows.map((row) =>
        this.toSafeCommunication(row, recipientsByCommunicationId.get(row.id) ?? [])
      ),
      events
    };
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

  toSafeRecipient(recipient: CommunicationRecipient) {
    return {
      id: recipient.id,
      email: recipient.email,
      recipientType: recipient.recipientType,
      status: recipient.status,
      acceptedAt: recipient.acceptedAt,
      deliveredAt: recipient.deliveredAt,
      deferredAt: recipient.deferredAt,
      failedAt: recipient.failedAt,
      failureReason: recipient.failureReason,
      createdAt: recipient.createdAt,
      updatedAt: recipient.updatedAt
    };
  }

  toSafeCommunication(
    communication: Communication,
    recipients: CommunicationRecipient[] = []
  ) {
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
      recipients: recipients.map((recipient) => this.toSafeRecipient(recipient)),
      createdAt: communication.createdAt,
      updatedAt: communication.updatedAt
    };
  }

  private async listRecipients(communicationId: string) {
    return this.databaseService.db
      .select()
      .from(communicationRecipients)
      .where(eq(communicationRecipients.communicationId, communicationId))
      .orderBy(communicationRecipients.email);
  }

  private async findCommunicationRecipient(communicationId: string, email: string) {
    const [row] = await this.databaseService.db
      .select()
      .from(communicationRecipients)
      .where(
        and(
          eq(communicationRecipients.communicationId, communicationId),
          eq(communicationRecipients.email, email)
        )
      )
      .limit(1);

    return row ?? null;
  }

  /**
   * Advances one recipient only when its currently persisted state is a valid
   * predecessor. The state check lives inside the UPDATE so concurrent
   * webhook deliveries cannot regress each other; a stale writer updates zero
   * rows and is safely ignored.
   */
  private async tryAdvanceRecipient(
    recipient: CommunicationRecipient,
    mapped: MappedBrevoEvent,
    occurredAt: Date
  ): Promise<boolean> {
    const nextStatus =
      mapped.outcome === "accepted"
        ? "accepted"
        : mapped.outcome === "delivered"
          ? "delivered"
          : mapped.outcome === "deferred"
            ? "deferred"
            : "failed";

    if (!RECIPIENT_PREDECESSORS[nextStatus].includes(recipient.status)) {
      return false;
    }

    const patch: Partial<CommunicationRecipient> = { status: nextStatus, updatedAt: occurredAt };

    if (nextStatus === "accepted") {
      patch.acceptedAt = occurredAt;
    } else if (nextStatus === "delivered") {
      patch.deliveredAt = occurredAt;
    } else if (nextStatus === "deferred") {
      patch.deferredAt = occurredAt;
    } else {
      patch.failedAt = occurredAt;
      patch.failureReason =
        FAILURE_REASONS[mapped.eventType] ?? "The email provider reported a delivery failure.";
    }

    const updated = await this.databaseService.db
      .update(communicationRecipients)
      .set(patch)
      .where(
        and(
          eq(communicationRecipients.id, recipient.id),
          eq(communicationRecipients.status, recipient.status)
        )
      )
      .returning({ id: communicationRecipients.id });

    return updated.length > 0;
  }

  /**
   * Recomputes the parent communication state from its recipient rows. The
   * parent is derived data: recipient transitions above are the concurrency
   * authority, and this refresh converges to the same aggregate regardless of
   * webhook arrival order.
   */
  private async refreshCommunicationAggregate(communicationId: string): Promise<void> {
    const [communication] = await this.databaseService.db
      .select()
      .from(communications)
      .where(eq(communications.id, communicationId))
      .limit(1);

    if (!communication) {
      return;
    }

    const recipients = await this.listRecipients(communicationId);

    if (recipients.length === 0) {
      return;
    }

    const aggregate = aggregateRecipientStatuses(recipients.map((row) => row.status));

    if (aggregate === communication.status) {
      return;
    }

    const deliveredAt = maxTimestamp(recipients.map((row) => row.deliveredAt));
    const failedAt = maxTimestamp(recipients.map((row) => row.failedAt));
    const deferredAt = maxTimestamp(recipients.map((row) => row.deferredAt));
    const failedRecipients = recipients.filter((row) => row.status === "failed");
    const now = new Date();

    await this.databaseService.db
      .update(communications)
      .set({
        status: aggregate,
        deliveredAt: aggregate === "delivered" ? (deliveredAt ?? now) : communication.deliveredAt,
        deferredAt:
          aggregate === "deferred" || aggregate === "in_progress"
            ? (deferredAt ?? communication.deferredAt)
            : communication.deferredAt,
        failedAt:
          aggregate === "failed" || aggregate === "partially_failed"
            ? (failedAt ?? now)
            : communication.failedAt,
        failureReason:
          aggregate === "failed" || aggregate === "partially_failed"
            ? this.aggregateFailureReason(recipients, failedRecipients.length)
            : communication.failureReason,
        updatedAt: now
      })
      .where(eq(communications.id, communication.id));

    if (
      aggregate === "delivered" ||
      aggregate === "failed" ||
      aggregate === "partially_failed"
    ) {
      await this.auditSafely({
        organisationId: communication.organisationId,
        actorUserId: null,
        action:
          aggregate === "delivered" ? "invoice_email_delivered" : "invoice_email_failed",
        entityType: "invoice",
        entityId: communication.invoiceId,
        metadataRedacted: {
          communicationId: communication.id,
          aggregate,
          failedRecipients: failedRecipients.map((row) => row.email)
        }
      });
    }
  }

  private aggregateFailureReason(
    recipients: CommunicationRecipient[],
    failedCount: number
  ): string {
    if (failedCount === 1) {
      return (
        recipients.find((row) => row.status === "failed")?.failureReason ??
        "The email provider reported a delivery failure."
      );
    }

    return `${failedCount} of ${recipients.length} recipients failed delivery. See the activity timeline for the affected addresses.`;
  }

  /**
   * Legacy fallback for events that cannot be resolved to a recipient row.
   * Uses the same conditional-update protection as the recipient path.
   */
  private async tryAdvanceCommunication(
    communication: Communication,
    mapped: MappedBrevoEvent,
    occurredAt: Date
  ): Promise<boolean> {
    const nextStatus =
      mapped.outcome === "accepted"
        ? "accepted"
        : mapped.outcome === "delivered"
          ? "delivered"
          : mapped.outcome === "deferred"
            ? "deferred"
            : "failed";

    if (STATUS_RANK[nextStatus] <= STATUS_RANK[communication.status]) {
      return false;
    }

    const patch: Partial<Communication> = { status: nextStatus, updatedAt: occurredAt };

    if (nextStatus === "accepted") {
      patch.acceptedAt = occurredAt;
    } else if (nextStatus === "delivered") {
      patch.deliveredAt = occurredAt;
    } else if (nextStatus === "deferred") {
      patch.deferredAt = occurredAt;
    } else {
      patch.failedAt = occurredAt;
      patch.failureReason =
        FAILURE_REASONS[mapped.eventType] ?? "The email provider reported a delivery failure.";
    }

    const updated = await this.databaseService.db
      .update(communications)
      .set(patch)
      .where(
        and(
          eq(communications.id, communication.id),
          eq(communications.status, communication.status)
        )
      )
      .returning({ id: communications.id });

    if (updated.length === 0) {
      return false;
    }

    if (nextStatus === "delivered" || nextStatus === "failed") {
      await this.auditSafely({
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

    return true;
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
