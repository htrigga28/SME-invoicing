import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, count, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";

import { DatabaseService, type AppDatabase } from "../../database/database.service";
import {
  communicationEventQuarantine,
  communicationEvents,
  communicationRecipients,
  communications,
  invoiceViewEvents,
  type Communication,
  type CommunicationRecipient,
  type Invoice
} from "../../database/schema";
import { AuditLogService } from "../audit-log/audit-log.service";
import { RESEND_COMMUNICATION_TAG, ResendEmailProvider } from "./resend-email.provider";
import {
  buildInvoiceEmailHtml,
  buildInvoiceEmailText,
  defaultInvoiceEmailSubject,
  EmailIdempotencyConflictError,
  EmailUncertainError,
  type SendEmailInput,
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

export type ResendWebhookPayload = {
  type?: unknown;
  created_at?: unknown;
  data?: {
    email_id?: unknown;
    message_id?: unknown;
    from?: unknown;
    to?: unknown;
    subject?: unknown;
    tags?: unknown;
  } | null;
};

export type ResendWebhookHeaders = {
  svixId?: string | undefined;
  svixTimestamp?: string | undefined;
  svixSignature?: string | undefined;
};

type MappedResendEvent = {
  outcome: "accepted" | "delivered" | "deferred" | "failed" | "ignored";
  eventType: string;
};

type DatabaseTransaction = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

type ParsedResendWebhookEvent = {
  correlationCommunicationId: string | null;
  /** Normalized recipient addresses impacted by this event. */
  emails: string[];
  eventKey: string;
  eventType: MappedResendEvent;
  /** Resend email_id; stored as the communication provider message ID. */
  emailId: string | null;
  occurredAt: Date;
  /** Svix message id; the authoritative webhook event identity. */
  providerEventId: string | null;
};

/**
 * Resend retains email idempotency keys for 24 hours. Same-attempt recovery
 * retries are allowed only inside this window; afterwards only an explicit
 * new attempt (new row, new key) may send.
 */
const RESEND_IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

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
  "email.bounced": "The email address bounced. Check the recipient and try again.",
  "email.failed": "The email provider reported a delivery failure.",
  "email.complained": "The recipient marked the email as spam.",
  "email.suppressed": "The email was not sent because the provider suppressed this recipient.",
  error: "The email provider reported an error."
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export function mapResendEventType(rawEvent: string): MappedResendEvent {
  const normalized = rawEvent.trim().toLowerCase();

  switch (normalized) {
    case "email.sent":
      return { outcome: "accepted", eventType: normalized };
    case "email.delivered":
    case "delivered":
      return { outcome: "delivered", eventType: normalized };
    case "email.delivery_delayed":
    case "deferred":
      return { outcome: "deferred", eventType: normalized };
    case "email.bounced":
    case "email.failed":
    case "email.complained":
    case "email.suppressed":
    case "failed":
      return { outcome: "failed", eventType: normalized };
    case "email.opened":
    case "email.clicked":
      return { outcome: "ignored", eventType: normalized };
    default:
      return { outcome: "ignored", eventType: normalized || "unknown" };
  }
}

const SVIX_TIMESTAMP_TOLERANCE_SECONDS = 300;

/**
 * Verifies a Resend (Svix) webhook signature without the Svix SDK, which
 * ships ESM-only and cannot load under the API's CommonJS Jest runtime.
 * Algorithm per the Svix verification spec: base64-decode the secret after
 * stripping the `whsec_` prefix, HMAC-SHA256 over
 * `<svix-id>.<svix-timestamp>.<raw-body>`, and compare against every
 * versioned signature in `svix-signature` with a timing-safe equality check.
 * Messages older or newer than the tolerance window are rejected.
 */
export function verifySvixSignature(
  secret: string,
  headers: {
    svixId?: string | undefined;
    svixTimestamp?: string | undefined;
    svixSignature?: string | undefined;
  },
  rawBody: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
  const svixId = headers.svixId;
  const svixTimestamp = headers.svixTimestamp;
  const svixSignature = headers.svixSignature;

  if (!svixId || !svixTimestamp || !svixSignature) {
    return false;
  }

  const timestamp = Number(svixTimestamp);

  if (
    !Number.isFinite(timestamp) ||
    Math.abs(nowSeconds - timestamp) > SVIX_TIMESTAMP_TOLERANCE_SECONDS
  ) {
    return false;
  }

  let key: Buffer;

  try {
    const stripped = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
    key = Buffer.from(stripped, "base64");

    if (key.length === 0) {
      return false;
    }
  } catch {
    return false;
  }

  const expected = createHmac("sha256", key)
    .update(`${svixId}.${svixTimestamp}.${rawBody}`)
    .digest();
  const candidates = svixSignature.split(" ");

  for (const candidate of candidates) {
    const comma = candidate.indexOf(",");
    const encoded = comma >= 0 ? candidate.slice(comma + 1) : candidate;
    let actual: Buffer;

    try {
      actual = Buffer.from(encoded, "base64");
    } catch {
      continue;
    }

    if (actual.length === expected.length && timingSafeEqual(actual, expected)) {
      return true;
    }
  }

  return false;
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
    @Inject(ResendEmailProvider) private readonly resendEmailProvider: ResendEmailProvider,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService
  ) {}

  async sendInvoiceEmail(
    input: {
      organisationId: string;
      userId: string;
      invoice: Pick<Invoice, "id" | "invoiceNumber">;
      customerId: string;
      content?: SendInvoiceEmailInput;
    },
    options?: {
      communication?: Communication;
      claimToken?: string;
      idempotencyKey?: string;
      /** Replays a stored immutable provider request instead of building one. */
      snapshot?: SendEmailInput;
    }
  ): Promise<{ communication: Communication; outcome: "accepted" | "uncertain" }> {
    if (!this.resendEmailProvider.isConfigured()) {
      throw new ServiceUnavailableException(
        "Email delivery is not configured. The invoice is issued and the public link can still be shared."
      );
    }

    let snapshot: SendEmailInput;
    let recipients: { to: string[]; cc: string[] };

    if (options?.snapshot) {
      // Internal recovery replay: the exact stored provider request goes out
      // verbatim. Caller content is ignored so a reused key can never meet a
      // different payload.
      snapshot = options.snapshot;
      recipients = {
        to: snapshot.to.map((recipient) => recipient.email),
        cc: snapshot.cc.map((recipient) => recipient.email)
      };
    } else {
      const content = input.content;

      if (!content) {
        throw new BadRequestException("Email content is required for a new send attempt.");
      }

      try {
        recipients = validateSendRecipients(content.to, content.cc ?? []);
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : "Recipients are invalid."
        );
      }

      const subject =
        content.subject?.trim() ||
        defaultInvoiceEmailSubject(content.invoiceNumber, content.businessName);
      const htmlContent = buildInvoiceEmailHtml({
        businessName: content.businessName,
        customerName: content.customerName,
        invoiceNumber: content.invoiceNumber,
        amountDueKobo: content.amountDueKobo,
        currency: "NGN",
        dueDate: content.dueDate,
        publicUrl: content.publicUrl
      });
      const textContent = buildInvoiceEmailText({
        businessName: content.businessName,
        customerName: content.customerName,
        invoiceNumber: content.invoiceNumber,
        amountDueKobo: content.amountDueKobo,
        currency: "NGN",
        dueDate: content.dueDate,
        publicUrl: content.publicUrl
      });
      const customerName = content.customerName;
      snapshot = {
        fromEmail: this.resendEmailProvider.getFromEmail()!,
        fromName: `${content.businessName} via Lumina`,
        replyToEmail: content.businessEmail,
        to: recipients.to.map((email) => ({
          email,
          name: email === recipients.to[0] ? customerName : null
        })),
        cc: recipients.cc.map((email) => ({ email })),
        subject,
        htmlContent,
        textContent,
        tags: ["invoice_delivery", content.invoiceNumber],
        correlationId: options?.communication?.id ?? randomUUID()
      };
    }

    const claimToken = options?.claimToken ?? randomUUID();
    const idempotencyKey = options?.idempotencyKey ?? randomUUID();
    const idempotencyExpiresAt = new Date(Date.now() + RESEND_IDEMPOTENCY_WINDOW_MS);
    const communicationId = options?.communication?.id ?? randomUUID();
    snapshot.correlationId = communicationId;
    const communication =
      options?.communication ??
      (await this.createPendingCommunication(
        input,
        snapshot,
        idempotencyKey,
        idempotencyExpiresAt,
        claimToken,
        communicationId
      ));

    // Provider boundary: only an explicit provider rejection may mark the
    // attempt failed. Anything ambiguous (transport/timeout/5xx/unreadable)
    // is recorded as uncertain so a later retry cannot silently duplicate mail.
    let providerMessageId: string;

    try {
      ({ providerMessageId } = await this.resendEmailProvider.sendEmail({
        ...snapshot,
        idempotencyKey,
        correlationId: communication.id
      }));
    } catch (error) {
      if (error instanceof EmailUncertainError) {
        const current = await this.completeUncertainAttempt(
          communication,
          claimToken,
          error.message
        );
        return { communication: current ?? communication, outcome: "uncertain" as const };
      }

      if (error instanceof EmailIdempotencyConflictError) {
        await this.releaseClaimWithReason(communication, claimToken, error.message);
        await this.auditSafely({
          organisationId: input.organisationId,
          actorUserId: input.userId,
          action: "invoice_email_idempotency_conflict",
          entityType: "invoice",
          entityId: input.invoice.id,
          metadataRedacted: {
            invoiceNumber: input.invoice.invoiceNumber,
            communicationId: communication.id
          }
        });
        throw error;
      }

      const failed = await this.completeFailedAttempt(
        communication,
        claimToken,
        error instanceof Error && error.message
          ? error.message
          : "Email provider could not send the message."
      );

      if (failed) {
        await this.auditSafely({
          organisationId: input.organisationId,
          actorUserId: input.userId,
          action: "invoice_email_failed",
          entityType: "invoice",
          entityId: input.invoice.id,
          metadataRedacted: {
            invoiceNumber: input.invoice.invoiceNumber,
            communicationId: communication.id
          }
        });
      }

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
      const persisted = await this.persistProviderAcceptance(
        communication,
        claimToken,
        providerMessageId,
        acceptedAt
      );

      if (!persisted.applied) {
        return { communication: persisted.communication, outcome: "uncertain" };
      }

      accepted = persisted.communication;
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
        invoiceNumber: input.invoice.invoiceNumber,
        communicationId: communication.id,
        recipientCount: recipients.to.length + recipients.cc.length
      }
    });

    return { communication: accepted, outcome: "accepted" as const };
  }

  /**
   * Explicit user resend. Always creates a NEW communication attempt with a
   * new idempotency key; previous attempts stay immutable history. When the
   * latest attempt is still unresolved, the resend is refused unless the
   * caller explicitly forces another send, because the outstanding attempt
   * may yet deliver and a second email would duplicate mail.
   */
  async resendInvoiceEmail(
    input: {
      organisationId: string;
      userId: string;
      invoice: Pick<Invoice, "id" | "invoiceNumber">;
      customerId: string;
      content: SendInvoiceEmailInput;
    },
    options?: { force?: boolean }
  ): Promise<{ communication: Communication; outcome: "accepted" | "uncertain" }> {
    const latest = await this.findLatestCommunication(input.organisationId, input.invoice.id);

    if (latest && ["pending", "submission_uncertain"].includes(latest.status) && !options?.force) {
      throw new ConflictException(
        "A previous delivery attempt is still unresolved. Wait for its outcome, retry it, or resend explicitly."
      );
    }

    if (options?.force && latest && ["pending", "submission_uncertain"].includes(latest.status)) {
      await this.auditSafely({
        organisationId: input.organisationId,
        actorUserId: input.userId,
        action: "invoice_email_force_resend",
        entityType: "invoice",
        entityId: input.invoice.id,
        metadataRedacted: {
          invoiceNumber: input.invoice.invoiceNumber,
          supersededCommunicationId: latest.id
        }
      });
    }

    return this.sendInvoiceEmail(input);
  }

  /**
   * Internal recovery retry of one unresolved logical attempt. Replays the
   * stored immutable provider request with the original idempotency key, and
   * only inside the provider's idempotency window. Late webhooks can still
   * resolve the attempt afterwards; only explicit resends create new rows.
   */
  async retryUncertainAttempt(input: {
    organisationId: string;
    userId: string;
    invoice: Pick<Invoice, "id" | "invoiceNumber">;
    communicationId: string;
  }): Promise<{ communication: Communication; outcome: "accepted" | "uncertain" }> {
    const [row] = await this.databaseService.db
      .select()
      .from(communications)
      .where(
        and(
          eq(communications.id, input.communicationId),
          eq(communications.organisationId, input.organisationId),
          eq(communications.invoiceId, input.invoice.id)
        )
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException("Delivery attempt was not found.");
    }

    if (!["pending", "submission_uncertain"].includes(row.status)) {
      throw new ConflictException("Only unresolved delivery attempts can be retried.");
    }

    if (!row.providerRequestSnapshot) {
      throw new ConflictException(
        "This attempt has no replayable provider request. Send a new email attempt instead."
      );
    }

    if (row.idempotencyExpiresAt && row.idempotencyExpiresAt <= new Date()) {
      throw new ConflictException(
        "The provider idempotency window for this attempt has expired. Send a new email attempt instead."
      );
    }

    const claimToken = randomUUID();
    const claimed = await this.claimRetry(row.id, claimToken);

    if (!claimed?.providerRequestSnapshot) {
      return {
        communication:
          (await this.findLatestCommunication(input.organisationId, input.invoice.id)) ?? row,
        outcome: "uncertain"
      };
    }

    return this.sendInvoiceEmail(
      {
        organisationId: input.organisationId,
        userId: input.userId,
        invoice: input.invoice,
        customerId: claimed.customerId
      },
      {
        communication: claimed,
        claimToken,
        idempotencyKey: claimed.providerIdempotencyKey,
        snapshot: claimed.providerRequestSnapshot
      }
    );
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

  private async createPendingCommunication(
    input: {
      organisationId: string;
      userId: string;
      invoice: Pick<Invoice, "id" | "invoiceNumber">;
      customerId: string;
      content?: SendInvoiceEmailInput;
    },
    snapshot: SendEmailInput,
    idempotencyKey: string,
    idempotencyExpiresAt: Date,
    claimToken: string,
    communicationId: string
  ): Promise<Communication> {
    const claimedAt = new Date();
    const toEmails = snapshot.to.map((recipient) => recipient.email);
    const ccEmails = snapshot.cc.map((recipient) => recipient.email);

    return this.databaseService.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(communications)
        .values({
          id: communicationId,
          organisationId: input.organisationId,
          invoiceId: input.invoice.id,
          customerId: input.customerId,
          purpose: "invoice_delivery",
          channel: "email",
          provider: "resend",
          subject: snapshot.subject,
          toRecipients: toEmails,
          ccRecipients: ccEmails,
          providerIdempotencyKey: idempotencyKey,
          idempotencyExpiresAt,
          providerRequestSnapshot: snapshot,
          retryClaimToken: claimToken,
          retryClaimedAt: claimedAt,
          status: "pending",
          createdByUserId: input.userId
        })
        .returning();

      if (!created) {
        throw new Error("Communication record could not be created.");
      }

      await tx.insert(communicationRecipients).values([
        ...toEmails.map((email) => ({
          organisationId: input.organisationId,
          communicationId: created.id,
          invoiceId: input.invoice.id,
          email,
          recipientType: "to",
          status: "pending" as RecipientStatus
        })),
        ...ccEmails.map((email) => ({
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
  }

  private retryClaimLeaseMs(): number {
    const timeout = Number(this.configService.get<number>("RESEND_REQUEST_TIMEOUT_MS") ?? 15000);
    return Math.max(1000, timeout) + 5000;
  }

  private async claimRetry(
    communicationId: string,
    claimToken: string
  ): Promise<Communication | null> {
    const claimedAt = new Date();
    const expiredBefore = new Date(claimedAt.getTime() - this.retryClaimLeaseMs());
    const [claimed] = await this.databaseService.db
      .update(communications)
      .set({ retryClaimToken: claimToken, retryClaimedAt: claimedAt, updatedAt: claimedAt })
      .where(
        and(
          eq(communications.id, communicationId),
          inArray(communications.status, ["pending", "submission_uncertain"]),
          or(
            isNull(communications.retryClaimToken),
            isNull(communications.retryClaimedAt),
            lt(communications.retryClaimedAt, expiredBefore)
          )
        )
      )
      .returning();

    return claimed ?? null;
  }

  private async lockCommunication(
    tx: DatabaseTransaction,
    communicationId: string
  ): Promise<Communication | null> {
    await tx.execute(sql`SELECT 1 FROM communications WHERE id = ${communicationId} FOR UPDATE`);
    const [communication] = await tx
      .select()
      .from(communications)
      .where(eq(communications.id, communicationId))
      .limit(1);
    return communication ?? null;
  }

  private async completeUncertainAttempt(
    communication: Communication,
    claimToken: string,
    message: string
  ): Promise<Communication | null> {
    return this.databaseService.db.transaction(async (tx) => {
      const current = await this.lockCommunication(tx, communication.id);

      if (!current || current.retryClaimToken !== claimToken) {
        return current;
      }

      const now = new Date();
      const [updated] = await tx
        .update(communications)
        .set({
          status: current.status === "pending" ? "submission_uncertain" : current.status,
          failureReason:
            current.status === "pending" ? message.slice(0, 300) : current.failureReason,
          retryClaimToken: null,
          retryClaimedAt: null,
          updatedAt: now
        })
        .where(
          and(eq(communications.id, current.id), eq(communications.retryClaimToken, claimToken))
        )
        .returning();

      return updated ?? current;
    });
  }

  private async completeFailedAttempt(
    communication: Communication,
    claimToken: string,
    message: string
  ): Promise<boolean> {
    return this.databaseService.db.transaction(async (tx) => {
      const current = await this.lockCommunication(tx, communication.id);

      if (!current || current.retryClaimToken !== claimToken) {
        return false;
      }

      const now = new Date();
      const updated = await tx
        .update(communications)
        .set({
          status: current.status === "pending" ? "failed" : current.status,
          failedAt: current.status === "pending" ? now : current.failedAt,
          failureReason:
            current.status === "pending" ? message.slice(0, 300) : current.failureReason,
          retryClaimToken: null,
          retryClaimedAt: null,
          updatedAt: now
        })
        .where(
          and(eq(communications.id, current.id), eq(communications.retryClaimToken, claimToken))
        )
        .returning({ id: communications.id });

      if (updated.length === 0 || current.status !== "pending") {
        return false;
      }

      await tx
        .update(communicationRecipients)
        .set({ status: "failed", failedAt: now, updatedAt: now })
        .where(
          and(
            eq(communicationRecipients.communicationId, current.id),
            eq(communicationRecipients.status, "pending")
          )
        );

      return true;
    });
  }

  /**
   * Releases the retry claim with a diagnostic reason while keeping the
   * attempt status unresolved. Used for idempotency invariant conflicts,
   * where neither failure nor success is proven.
   */
  private async releaseClaimWithReason(
    communication: Communication,
    claimToken: string,
    message: string
  ): Promise<void> {
    await this.databaseService.db.transaction(async (tx) => {
      const current = await this.lockCommunication(tx, communication.id);

      if (!current || current.retryClaimToken !== claimToken) {
        return;
      }

      await tx
        .update(communications)
        .set({
          failureReason: message.slice(0, 300),
          retryClaimToken: null,
          retryClaimedAt: null,
          updatedAt: new Date()
        })
        .where(
          and(eq(communications.id, current.id), eq(communications.retryClaimToken, claimToken))
        );
    });
  }

  private async persistProviderAcceptance(
    communication: Communication,
    claimToken: string,
    providerMessageId: string,
    acceptedAt: Date
  ): Promise<{ applied: boolean; communication: Communication }> {
    return this.databaseService.db.transaction(async (tx) => {
      const current = await this.lockCommunication(tx, communication.id);

      if (!current) {
        throw new Error("Accepted communication could not be saved.");
      }

      if (current.retryClaimToken !== claimToken) {
        return { applied: false, communication: current };
      }

      if (current.providerMessageId && current.providerMessageId !== providerMessageId) {
        throw new ConflictException(
          "The email provider returned a different message ID for this delivery attempt."
        );
      }

      const [updated] = await tx
        .update(communications)
        .set({
          providerMessageId,
          status:
            current.status === "pending" || current.status === "submission_uncertain"
              ? "accepted"
              : current.status,
          acceptedAt: current.acceptedAt ?? acceptedAt,
          retryClaimToken: null,
          retryClaimedAt: null,
          updatedAt: acceptedAt
        })
        .where(
          and(eq(communications.id, current.id), eq(communications.retryClaimToken, claimToken))
        )
        .returning();

      if (!updated) {
        return { applied: false, communication: current };
      }

      await tx
        .update(communicationRecipients)
        .set({
          status: "accepted",
          acceptedAt: sql`COALESCE(${communicationRecipients.acceptedAt}, ${acceptedAt})`,
          updatedAt: acceptedAt
        })
        .where(
          and(
            eq(communicationRecipients.communicationId, updated.id),
            eq(communicationRecipients.status, "pending")
          )
        );

      await this.resolveQuarantinedEvents(tx, updated);
      const resolved = await this.lockCommunication(tx, updated.id);

      return { applied: true, communication: resolved ?? updated };
    });
  }

  private async auditSafely(input: Parameters<AuditLogService["create"]>[0]): Promise<void> {
    try {
      await this.auditLogService.create(input);
    } catch {
      // Audit logging is observability, never authority: a logging failure
      // must not change delivery state or fail the request.
      this.logger.warn({ action: input.action, event: "communication_audit_write_failed" });
    }
  }

  async processResendWebhook(input: {
    headers: ResendWebhookHeaders;
    rawBody: string | Buffer;
    payload: ResendWebhookPayload;
  }): Promise<{ received: true; duplicate?: boolean; ignored?: boolean; unknown?: boolean }> {
    const secret = this.configService.get<string>("RESEND_WEBHOOK_SECRET");

    if (!secret) {
      throw new ServiceUnavailableException("Email webhooks are not configured.");
    }

    const raw = typeof input.rawBody === "string" ? input.rawBody : input.rawBody.toString("utf8");

    if (!verifySvixSignature(secret, input.headers, raw)) {
      throw new UnauthorizedException("Invalid webhook signature.");
    }

    const parsed = this.parseResendWebhook(input.headers.svixId, input.payload);
    let communication = parsed.emailId
      ? await this.findCommunicationByMessageId(parsed.emailId)
      : null;

    if (!communication && parsed.correlationCommunicationId) {
      communication = await this.findCommunicationById(parsed.correlationCommunicationId);
    }

    if (!parsed.providerEventId || !communication) {
      await this.quarantineResendWebhook(
        parsed,
        !parsed.providerEventId ? "invalid_provider_event_id" : "unmatched_communication"
      );
      return !parsed.providerEventId
        ? { received: true, ignored: true }
        : { received: true, unknown: true };
    }

    return this.processMatchedResendWebhook(communication.id, parsed);
  }

  private parseResendWebhook(
    svixId: string | undefined,
    payload: ResendWebhookPayload
  ): ParsedResendWebhookEvent {
    const providerEventId = this.readSvixMessageId(svixId);
    const data = payload.data ?? null;
    const emailId = this.readResendEmailId(data);
    const correlationCommunicationId = this.readResendCorrelation(data);
    const emails = this.readResendRecipients(data);
    const eventType = mapResendEventType(typeof payload.type === "string" ? payload.type : "");
    const occurredAt = this.readResendOccurredAt(payload.created_at);
    const eventKey = providerEventId
      ? `resend:${providerEventId}`
      : `resend:invalid:${createHash("sha256")
          .update(
            JSON.stringify({
              correlationCommunicationId,
              emails,
              eventType: eventType.eventType,
              emailId,
              occurredAt: occurredAt.toISOString()
            })
          )
          .digest("hex")}`;

    return {
      correlationCommunicationId,
      emails,
      eventKey,
      eventType,
      emailId,
      occurredAt,
      providerEventId
    };
  }

  private async quarantineResendWebhook(
    event: ParsedResendWebhookEvent,
    reason: "invalid_provider_event_id" | "unmatched_communication"
  ): Promise<void> {
    await this.databaseService.db
      .insert(communicationEventQuarantine)
      .values({
        provider: "resend",
        providerEventId: event.providerEventId,
        providerEventKey: event.eventKey,
        providerMessageId: event.emailId,
        correlationCommunicationId: event.correlationCommunicationId,
        eventType: event.eventType.eventType,
        occurredAt: event.occurredAt,
        recipientEmail: event.emails[0] ?? null,
        reason
      })
      .onConflictDoNothing({ target: communicationEventQuarantine.providerEventKey });
  }

  private async processMatchedResendWebhook(
    communicationId: string,
    event: ParsedResendWebhookEvent
  ): Promise<{ received: true; duplicate?: boolean; ignored?: boolean; unknown?: boolean }> {
    const result = await this.databaseService.db.transaction(async (tx) => {
      const communication = await this.lockCommunication(tx, communicationId);

      if (!communication) {
        return { response: { received: true, unknown: true } as const, audit: null };
      }

      const inserted = await tx
        .insert(communicationEvents)
        .values({
          organisationId: communication.organisationId,
          communicationId: communication.id,
          invoiceId: communication.invoiceId,
          provider: "resend",
          providerEventKey: event.eventKey,
          eventType: event.eventType.eventType,
          occurredAt: event.occurredAt,
          metadataRedacted: event.emails.length > 0 ? { emails: event.emails } : null
        })
        .onConflictDoNothing({ target: communicationEvents.providerEventKey })
        .returning({ id: communicationEvents.id });

      if (inserted.length === 0) {
        return { response: { received: true, duplicate: true } as const, audit: null };
      }

      await tx
        .update(communicationEventQuarantine)
        .set({ resolvedCommunicationId: communication.id, resolvedAt: new Date() })
        .where(
          and(
            eq(communicationEventQuarantine.providerEventKey, event.eventKey),
            isNull(communicationEventQuarantine.resolvedAt)
          )
        );

      if (event.eventType.outcome === "ignored") {
        return { response: { received: true } as const, audit: null };
      }

      // Resend reports every impacted recipient in one event. Advance each
      // known recipient row; an event that names no known recipient must not
      // change delivery truth.
      let foundRecipient = false;
      let advancedAny = false;

      for (const address of event.emails) {
        const recipient = await this.findCommunicationRecipientInTransaction(
          tx,
          communication.id,
          address
        );

        if (recipient) {
          foundRecipient = true;
          advancedAny =
            (await this.tryAdvanceRecipient(tx, recipient, event.eventType, event.occurredAt)) ||
            advancedAny;
        }
      }

      if (foundRecipient) {
        const aggregate = advancedAny
          ? await this.refreshCommunicationAggregate(tx, communication)
          : null;
        return { response: { received: true } as const, audit: aggregate };
      }

      const recipients = await this.listRecipientsInTransaction(tx, communication.id);

      if (recipients.length === 0) {
        return {
          response: { received: true } as const,
          audit: await this.tryAdvanceCommunication(
            tx,
            communication,
            event.eventType,
            event.occurredAt
          )
        };
      }

      // A known communication with recipient rows must not let an unknown or
      // absent recipient event change parent delivery truth.
      this.logger.warn({
        communicationId: communication.id,
        event: "resend_webhook_unknown_recipient"
      });
      return { response: { received: true } as const, audit: null };
    });

    if (result.audit) {
      await this.auditSafely(result.audit);
    }

    return result.response;
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

  toSafeCommunication(communication: Communication, recipients: CommunicationRecipient[] = []) {
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

  private async listRecipientsInTransaction(tx: DatabaseTransaction, communicationId: string) {
    return tx
      .select()
      .from(communicationRecipients)
      .where(eq(communicationRecipients.communicationId, communicationId))
      .orderBy(communicationRecipients.email);
  }

  private async findCommunicationRecipientInTransaction(
    tx: DatabaseTransaction,
    communicationId: string,
    email: string
  ) {
    const [row] = await tx
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
    tx: DatabaseTransaction,
    recipient: CommunicationRecipient,
    mapped: MappedResendEvent,
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

    const updated = await tx
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
   * The parent row is already locked by the caller. Read recipient truth only
   * after that lock, derive one aggregate, and write it in the same transaction.
   * This removes the stale-writer retry ceiling from the previous CAS loop.
   */
  private async refreshCommunicationAggregate(
    tx: DatabaseTransaction,
    communication: Communication
  ): Promise<Parameters<AuditLogService["create"]>[0] | null> {
    const recipients = await this.listRecipientsInTransaction(tx, communication.id);

    if (recipients.length === 0) {
      return null;
    }

    const aggregate = aggregateRecipientStatuses(recipients.map((row) => row.status));

    if (aggregate === communication.status) {
      return null;
    }

    const deliveredAt = maxTimestamp(recipients.map((row) => row.deliveredAt));
    const failedAt = maxTimestamp(recipients.map((row) => row.failedAt));
    const deferredAt = maxTimestamp(recipients.map((row) => row.deferredAt));
    const failedRecipients = recipients.filter((row) => row.status === "failed");
    const now = new Date();

    await tx
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

    if (aggregate !== "delivered" && aggregate !== "failed" && aggregate !== "partially_failed") {
      return null;
    }

    return {
      organisationId: communication.organisationId,
      actorUserId: null,
      action: aggregate === "delivered" ? "invoice_email_delivered" : "invoice_email_failed",
      entityType: "invoice",
      entityId: communication.invoiceId,
      metadataRedacted: {
        communicationId: communication.id,
        aggregate,
        failedRecipients: failedRecipients.map((row) => row.email)
      }
    };
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

  private async resolveQuarantinedEvents(
    tx: DatabaseTransaction,
    communication: Communication
  ): Promise<void> {
    const matches = [eq(communicationEventQuarantine.correlationCommunicationId, communication.id)];

    if (communication.providerMessageId) {
      matches.push(
        eq(communicationEventQuarantine.providerMessageId, communication.providerMessageId)
      );
    }

    const quarantined = await tx
      .select()
      .from(communicationEventQuarantine)
      .where(and(isNull(communicationEventQuarantine.resolvedAt), or(...matches)));

    let recipientChanged = false;

    for (const event of quarantined) {
      // Events with no authoritative provider ID remain quarantined for review.
      if (!event.providerEventId) {
        continue;
      }

      const inserted = await tx
        .insert(communicationEvents)
        .values({
          organisationId: communication.organisationId,
          communicationId: communication.id,
          invoiceId: communication.invoiceId,
          provider: "resend",
          providerEventKey: event.providerEventKey,
          eventType: event.eventType,
          occurredAt: event.occurredAt,
          metadataRedacted: event.recipientEmail ? { email: event.recipientEmail } : null
        })
        .onConflictDoNothing({ target: communicationEvents.providerEventKey })
        .returning({ id: communicationEvents.id });

      if (inserted.length > 0 && mapResendEventType(event.eventType).outcome !== "ignored") {
        const recipient = event.recipientEmail
          ? await this.findCommunicationRecipientInTransaction(
              tx,
              communication.id,
              event.recipientEmail
            )
          : null;

        if (recipient) {
          recipientChanged =
            (await this.tryAdvanceRecipient(
              tx,
              recipient,
              mapResendEventType(event.eventType),
              event.occurredAt
            )) || recipientChanged;
        }
      }

      await tx
        .update(communicationEventQuarantine)
        .set({ resolvedCommunicationId: communication.id, resolvedAt: new Date() })
        .where(eq(communicationEventQuarantine.id, event.id));
    }

    if (recipientChanged) {
      await this.refreshCommunicationAggregate(tx, communication);
    }
  }

  /**
   * Legacy fallback for events that cannot be resolved to a recipient row.
   * Uses the same conditional-update protection as the recipient path.
   */
  private async tryAdvanceCommunication(
    tx: DatabaseTransaction,
    communication: Communication,
    mapped: MappedResendEvent,
    occurredAt: Date
  ): Promise<Parameters<AuditLogService["create"]>[0] | null> {
    const nextStatus =
      mapped.outcome === "accepted"
        ? "accepted"
        : mapped.outcome === "delivered"
          ? "delivered"
          : mapped.outcome === "deferred"
            ? "deferred"
            : "failed";

    if (STATUS_RANK[nextStatus] <= STATUS_RANK[communication.status]) {
      return null;
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

    const updated = await tx
      .update(communications)
      .set(patch)
      .where(eq(communications.id, communication.id))
      .returning({ id: communications.id });

    if (updated.length === 0) {
      return null;
    }

    if (nextStatus === "delivered" || nextStatus === "failed") {
      return {
        organisationId: communication.organisationId,
        actorUserId: null,
        action: nextStatus === "delivered" ? "invoice_email_delivered" : "invoice_email_failed",
        entityType: "invoice",
        entityId: communication.invoiceId,
        metadataRedacted: {
          communicationId: communication.id,
          eventType: mapped.eventType
        }
      };
    }

    return null;
  }

  private async findCommunicationByMessageId(messageId: string) {
    const [row] = await this.databaseService.db
      .select()
      .from(communications)
      .where(eq(communications.providerMessageId, messageId))
      .limit(1);

    return row ?? null;
  }

  private async findCommunicationById(communicationId: string) {
    const [row] = await this.databaseService.db
      .select()
      .from(communications)
      .where(eq(communications.id, communicationId))
      .limit(1);

    return row ?? null;
  }

  private readSvixMessageId(svixId: string | undefined): string | null {
    if (typeof svixId !== "string") {
      return null;
    }

    const value = svixId.trim();

    if (value && value.length <= 200 && /^[A-Za-z0-9._:-]+$/.test(value)) {
      return value;
    }

    return null;
  }

  private readResendEmailId(data: ResendWebhookPayload["data"]): string | null {
    const candidate = data?.email_id;

    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }

    return null;
  }

  private readResendCorrelation(data: ResendWebhookPayload["data"]): string | null {
    const tags = data?.tags;

    // Resend webhook events expose tags as an object:
    // { "lumina_communication": "<uuid>", ... }. The send API accepts an
    // array shape instead, which is tolerated here for compatibility.
    if (tags !== null && typeof tags === "object" && !Array.isArray(tags)) {
      const value = (tags as Record<string, unknown>)[RESEND_COMMUNICATION_TAG];

      if (typeof value === "string" && UUID_PATTERN.test(value)) {
        return value;
      }

      return null;
    }

    if (Array.isArray(tags)) {
      for (const tag of tags) {
        if (
          typeof tag === "object" &&
          tag !== null &&
          (tag as { name?: unknown }).name === RESEND_COMMUNICATION_TAG &&
          typeof (tag as { value?: unknown }).value === "string" &&
          UUID_PATTERN.test((tag as { value: string }).value)
        ) {
          return (tag as { value: string }).value;
        }
      }
    }

    return null;
  }

  private readResendRecipients(data: ResendWebhookPayload["data"]): string[] {
    const to = data?.to;
    const candidates = Array.isArray(to) ? to : typeof to === "string" ? [to] : [];
    const seen = new Set<string>();
    const emails: string[] = [];

    for (const candidate of candidates) {
      if (typeof candidate !== "string") {
        continue;
      }

      const email = candidate.trim().toLowerCase();

      if (email && !seen.has(email)) {
        seen.add(email);
        emails.push(email);
      }
    }

    return emails;
  }

  private readResendOccurredAt(createdAt: unknown): Date {
    if (typeof createdAt === "string" && createdAt.trim()) {
      const parsed = new Date(createdAt);

      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return new Date();
  }
}
