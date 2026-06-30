import { createHmac, timingSafeEqual } from "crypto";
import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";

import type { AppDatabase } from "../../database/database.service";
import { DatabaseService } from "../../database/database.service";
import {
  auditLogs,
  invoiceStatusEvents,
  invoices,
  paymentEvents,
  payments,
  type Invoice,
  type Payment,
  type PaymentEvent
} from "../../database/schema";

type PaystackWebhookPayload = {
  event?: unknown;
  id?: unknown;
  data?: {
    id?: unknown;
    reference?: unknown;
    amount?: unknown;
    currency?: unknown;
    status?: unknown;
    gateway_response?: unknown;
    channel?: unknown;
    paid_at?: unknown;
    created_at?: unknown;
    customer?: {
      email?: unknown;
    };
    metadata?: unknown;
  };
};

type NormalizedWebhook = {
  eventType: string;
  payload: PaystackWebhookPayload;
  providerEventId: string | null;
  providerReference: string | null;
  redactedPayload: Record<string, unknown>;
};

type WebhookProcessingResult = {
  received: true;
};

type MismatchInput = {
  event: PaymentEvent;
  invoice?: Invoice;
  message: string;
  payment?: Payment;
};

const paystackProvider = "paystack";
const supportedChargeSuccessEvent = "charge.success";

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
    @Inject(ConfigService) private readonly configService: ConfigService
  ) {}

  async processPaystackWebhook(
    rawBody: Buffer,
    signature?: string
  ): Promise<WebhookProcessingResult> {
    this.verifyPaystackSignature(rawBody, signature);
    const webhook = this.parseWebhook(rawBody);

    await this.databaseService.db.transaction(async (tx) => {
      await this.processVerifiedWebhook(tx as AppDatabase, webhook);
    });

    return { received: true };
  }

  private verifyPaystackSignature(rawBody: Buffer, signature?: string) {
    if (!signature) {
      throw new UnauthorizedException("Missing Paystack signature.");
    }

    const secretKey = this.configService.get<string>("PAYSTACK_SECRET_KEY");

    if (!secretKey) {
      throw new ServiceUnavailableException("Paystack webhook processing is not configured.");
    }

    const expected = createHmac("sha512", secretKey).update(rawBody).digest("hex");

    if (!this.safeCompareHex(signature, expected)) {
      throw new UnauthorizedException("Invalid Paystack signature.");
    }
  }

  private safeCompareHex(received: string, expected: string) {
    if (!/^[a-f0-9]+$/i.test(received)) {
      return false;
    }

    const receivedBuffer = Buffer.from(received, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");

    if (receivedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(receivedBuffer, expectedBuffer);
  }

  private parseWebhook(rawBody: Buffer): NormalizedWebhook {
    let payload: PaystackWebhookPayload;

    try {
      payload = JSON.parse(rawBody.toString("utf8")) as PaystackWebhookPayload;
    } catch {
      throw new BadRequestException("Invalid Paystack webhook payload.");
    }

    const eventType = this.safeString(payload.event, 120);

    if (!eventType) {
      throw new BadRequestException("Invalid Paystack webhook event.");
    }

    const providerReference = this.safeString(payload.data?.reference, 120);
    const providerEventId =
      this.safeString(payload.id, 120) ?? this.safeString(payload.data?.id, 120);

    return {
      eventType,
      payload,
      providerEventId,
      providerReference,
      redactedPayload: this.redactPaystackPayload(payload)
    };
  }

  private async processVerifiedWebhook(tx: AppDatabase, webhook: NormalizedWebhook) {
    const duplicate = await this.findProcessedDuplicate(tx, webhook);
    const event = await this.createPaymentEvent(tx, webhook, duplicate);

    if (duplicate) {
      await this.createAuditLog(tx, {
        organisationId: duplicate.organisationId,
        action: "payment_webhook_duplicate_ignored",
        entityType: "payment_event",
        entityId: event.id,
        metadataRedacted: {
          duplicateOfEventId: duplicate.id,
          eventType: webhook.eventType,
          providerReference: webhook.providerReference
        }
      });
      return;
    }

    if (webhook.eventType !== supportedChargeSuccessEvent) {
      await this.markEventProcessed(tx, event.id, {
        errorMessage: "Unsupported Paystack event ignored."
      });
      return;
    }

    await this.processChargeSuccess(tx, event, webhook);
  }

  private async findProcessedDuplicate(tx: AppDatabase, webhook: NormalizedWebhook) {
    const duplicateConditions = [
      eq(paymentEvents.provider, paystackProvider),
      eq(paymentEvents.eventType, webhook.eventType),
      eq(paymentEvents.processed, true),
      isNull(paymentEvents.errorMessage)
    ];

    const identityConditions = [];

    if (webhook.providerEventId) {
      identityConditions.push(eq(paymentEvents.providerEventId, webhook.providerEventId));
    }

    if (webhook.providerReference) {
      identityConditions.push(eq(paymentEvents.providerReference, webhook.providerReference));
    }

    if (!identityConditions.length) {
      return undefined;
    }

    const [duplicate] = await tx
      .select()
      .from(paymentEvents)
      .where(and(...duplicateConditions, or(...identityConditions)!))
      .orderBy(desc(paymentEvents.createdAt))
      .limit(1);

    return duplicate;
  }

  private async createPaymentEvent(
    tx: AppDatabase,
    webhook: NormalizedWebhook,
    duplicate?: PaymentEvent
  ) {
    const processedAt = duplicate ? new Date() : null;
    const [event] = await tx
      .insert(paymentEvents)
      .values({
        organisationId: duplicate?.organisationId ?? null,
        paymentId: duplicate?.paymentId ?? null,
        provider: paystackProvider,
        providerEventId: duplicate ? null : webhook.providerEventId,
        providerReference: webhook.providerReference,
        eventType: webhook.eventType,
        signatureValid: true,
        processed: Boolean(duplicate),
        processedAt,
        duplicateOfEventId: duplicate?.id ?? null,
        payloadRedacted: webhook.redactedPayload,
        errorMessage: duplicate ? "Duplicate webhook ignored." : null
      })
      .returning();

    if (!event) {
      throw new Error("Payment event could not be stored.");
    }

    return event;
  }

  private async processChargeSuccess(
    tx: AppDatabase,
    event: PaymentEvent,
    webhook: NormalizedWebhook
  ) {
    if (!webhook.providerReference) {
      await this.markEventProcessed(tx, event.id, {
        errorMessage: "Missing payment reference."
      });
      return;
    }

    const payment = await this.findPaymentByReference(tx, webhook.providerReference);

    if (!payment) {
      await this.markEventProcessed(tx, event.id, {
        errorMessage: "Unknown payment reference."
      });
      await this.createAuditLog(tx, {
        organisationId: null,
        action: "payment_webhook_unknown_reference",
        entityType: "payment_event",
        entityId: event.id,
        metadataRedacted: {
          providerReference: webhook.providerReference,
          eventType: webhook.eventType
        }
      });
      return;
    }

    const invoice = await this.findInvoice(tx, payment.invoiceId);

    if (!invoice) {
      await this.markMismatch(tx, {
        event,
        payment,
        message: "Payment invoice was not found."
      });
      return;
    }

    await this.linkEventToPayment(tx, event.id, payment);

    const amountKobo = this.numberValue(webhook.payload.data?.amount);
    const currency = this.safeString(webhook.payload.data?.currency, 3);

    if (amountKobo !== payment.amountKobo) {
      await this.markMismatch(tx, {
        event,
        payment,
        invoice,
        message: "Payment amount did not match the pending payment."
      });
      return;
    }

    if (currency !== "NGN" || payment.currency !== "NGN") {
      await this.markMismatch(tx, {
        event,
        payment,
        invoice,
        message: "Payment currency did not match NGN."
      });
      return;
    }

    if (payment.status === "successful") {
      await this.markEventProcessed(tx, event.id, {
        errorMessage: "Payment was already successful."
      });
      await this.createAuditLog(tx, {
        organisationId: payment.organisationId,
        action: "payment_webhook_duplicate_ignored",
        entityType: "payment",
        entityId: payment.id,
        metadataRedacted: {
          eventId: event.id,
          providerReference: payment.providerReference
        }
      });
      return;
    }

    const paidAt = this.dateValue(webhook.payload.data?.paid_at) ?? new Date();
    await this.markPaymentSuccessful(tx, payment, webhook, paidAt);

    if (["cancelled", "void"].includes(invoice.status)) {
      await this.markEventProcessed(tx, event.id);
      await this.createAuditLog(tx, {
        organisationId: payment.organisationId,
        action: "payment_for_cancelled_or_void_invoice",
        entityType: "payment",
        entityId: payment.id,
        metadataRedacted: {
          eventId: event.id,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          invoiceStatus: invoice.status,
          providerReference: payment.providerReference
        }
      });
      return;
    }

    await this.reconcileInvoice(tx, invoice, payment, event.id, paidAt);
    await this.markEventProcessed(tx, event.id);
  }

  private async findPaymentByReference(tx: AppDatabase, providerReference: string) {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.provider, paystackProvider),
          eq(payments.providerReference, providerReference)
        )
      )
      .limit(1);

    return payment;
  }

  private async findInvoice(tx: AppDatabase, invoiceId: string) {
    const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
    return invoice;
  }

  private async linkEventToPayment(tx: AppDatabase, eventId: string, payment: Payment) {
    await tx
      .update(paymentEvents)
      .set({
        organisationId: payment.organisationId,
        paymentId: payment.id,
        providerReference: payment.providerReference,
        errorMessage: null
      })
      .where(eq(paymentEvents.id, eventId));
  }

  private async markPaymentSuccessful(
    tx: AppDatabase,
    payment: Payment,
    webhook: NormalizedWebhook,
    paidAt: Date
  ) {
    const metadata = {
      ...(typeof payment.metadataRedacted === "object" && payment.metadataRedacted
        ? payment.metadataRedacted
        : {}),
      webhookEvent: webhook.eventType,
      providerStatus: this.safeString(webhook.payload.data?.status, 80)
    };

    await tx
      .update(payments)
      .set({
        status: "successful",
        paidAt,
        channel: this.safeString(webhook.payload.data?.channel, 80),
        gatewayResponse: this.safeString(webhook.payload.data?.gateway_response, 500),
        metadataRedacted: metadata,
        updatedAt: new Date()
      })
      .where(eq(payments.id, payment.id));
  }

  private async reconcileInvoice(
    tx: AppDatabase,
    invoice: Invoice,
    payment: Payment,
    eventId: string,
    paidAt: Date
  ) {
    const amountPaidKobo = await this.sumSuccessfulPayments(tx, invoice.id);
    const balanceDueKobo = Math.max(invoice.totalKobo - amountPaidKobo, 0);
    const nextStatus = this.nextInvoiceStatus(invoice, amountPaidKobo, balanceDueKobo);
    const overpaymentReview = amountPaidKobo > invoice.totalKobo;
    const statusChanged = nextStatus !== invoice.status;
    const invoicePaidAt = nextStatus === "paid" ? (invoice.paidAt ?? paidAt) : invoice.paidAt;

    await tx
      .update(invoices)
      .set({
        amountPaidKobo,
        balanceDueKobo,
        status: nextStatus,
        paidAt: invoicePaidAt,
        updatedAt: new Date()
      })
      .where(eq(invoices.id, invoice.id));

    if (statusChanged) {
      await tx.insert(invoiceStatusEvents).values({
        organisationId: invoice.organisationId,
        invoiceId: invoice.id,
        fromStatus: invoice.status,
        toStatus: nextStatus,
        reason: "payment_webhook_reconciled",
        actorUserId: null,
        metadataRedacted: {
          eventId,
          paymentId: payment.id,
          providerReference: payment.providerReference,
          amountPaidKobo,
          balanceDueKobo
        }
      });

      await this.createAuditLog(tx, {
        organisationId: invoice.organisationId,
        action: "invoice_status_updated",
        entityType: "invoice",
        entityId: invoice.id,
        metadataRedacted: {
          eventId,
          fromStatus: invoice.status,
          toStatus: nextStatus,
          invoiceNumber: invoice.invoiceNumber
        }
      });
    }

    await this.createAuditLog(tx, {
      organisationId: invoice.organisationId,
      action: "payment_succeeded",
      entityType: "payment",
      entityId: payment.id,
      metadataRedacted: {
        eventId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        providerReference: payment.providerReference,
        amountPaidKobo,
        balanceDueKobo,
        overpaymentReview
      }
    });
  }

  private async sumSuccessfulPayments(tx: AppDatabase, invoiceId: string) {
    const [row] = await tx
      .select({
        total: sql<number>`coalesce(sum(${payments.amountKobo}), 0)`
      })
      .from(payments)
      .where(and(eq(payments.invoiceId, invoiceId), eq(payments.status, "successful")));

    return Number(row?.total ?? 0);
  }

  private nextInvoiceStatus(
    invoice: Invoice,
    amountPaidKobo: number,
    balanceDueKobo: number
  ): Invoice["status"] {
    if (amountPaidKobo >= invoice.totalKobo || balanceDueKobo === 0) {
      return "paid";
    }

    if (amountPaidKobo > 0) {
      return "partially_paid";
    }

    return this.isOverdue(invoice, balanceDueKobo) ? "overdue" : invoice.status;
  }

  private isOverdue(invoice: Invoice, balanceDueKobo: number) {
    if (["draft", "paid", "cancelled", "void"].includes(invoice.status) || balanceDueKobo <= 0) {
      return false;
    }

    const today = new Date();
    const dueDate = new Date(`${invoice.dueDate}T00:00:00.000Z`);
    const todayStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    );

    return dueDate < todayStart;
  }

  private async markMismatch(inputTx: AppDatabase, input: MismatchInput) {
    await this.markEventProcessed(inputTx, input.event.id, {
      errorMessage: input.message
    });

    await this.createAuditLog(inputTx, {
      organisationId: input.payment?.organisationId ?? input.invoice?.organisationId ?? null,
      action: input.payment ? "payment_webhook_mismatch" : "payment_webhook_unknown_reference",
      entityType: input.payment ? "payment" : "payment_event",
      entityId: input.payment?.id ?? input.event.id,
      metadataRedacted: {
        eventId: input.event.id,
        paymentId: input.payment?.id,
        invoiceId: input.invoice?.id,
        providerReference: input.payment?.providerReference ?? input.event.providerReference,
        message: input.message
      }
    });
  }

  private async markEventProcessed(
    tx: AppDatabase,
    eventId: string,
    input: { errorMessage?: string } = {}
  ) {
    await tx
      .update(paymentEvents)
      .set({
        processed: true,
        processedAt: new Date(),
        errorMessage: input.errorMessage ?? null
      })
      .where(eq(paymentEvents.id, eventId));
  }

  private async createAuditLog(
    tx: AppDatabase,
    input: {
      action: string;
      entityId?: string | null;
      entityType: string;
      metadataRedacted?: Record<string, unknown>;
      organisationId?: string | null;
    }
  ) {
    await tx.insert(auditLogs).values({
      organisationId: input.organisationId ?? null,
      actorUserId: null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadataRedacted: input.metadataRedacted ?? null
    });
  }

  private redactPaystackPayload(payload: PaystackWebhookPayload): Record<string, unknown> {
    const metadata =
      typeof payload.data?.metadata === "object" && payload.data.metadata !== null
        ? this.redactMetadata(payload.data.metadata as Record<string, unknown>)
        : undefined;

    return {
      event: this.safeString(payload.event, 120),
      data: {
        reference: this.safeString(payload.data?.reference, 120),
        amount: this.numberValue(payload.data?.amount),
        currency: this.safeString(payload.data?.currency, 3),
        status: this.safeString(payload.data?.status, 80),
        gateway_response: this.safeString(payload.data?.gateway_response, 500),
        channel: this.safeString(payload.data?.channel, 80),
        paid_at: this.safeString(payload.data?.paid_at, 80),
        created_at: this.safeString(payload.data?.created_at, 80),
        customer: {
          email: this.safeString(payload.data?.customer?.email, 320)
        },
        metadata
      }
    };
  }

  private redactMetadata(metadata: Record<string, unknown>) {
    const allowedKeys = ["invoiceId", "invoiceNumber", "customerId", "organisationId", "source"];
    const redacted: Record<string, unknown> = {};

    for (const key of allowedKeys) {
      const value = metadata[key];

      if (["string", "number", "boolean"].includes(typeof value) || value === null) {
        redacted[key] = value;
      }
    }

    return redacted;
  }

  private safeString(value: unknown, maxLength: number) {
    if (typeof value !== "string" && typeof value !== "number") {
      return null;
    }

    const next = String(value).trim();
    return next ? next.slice(0, maxLength) : null;
  }

  private numberValue(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  private dateValue(value: unknown) {
    const stringValue = this.safeString(value, 80);

    if (!stringValue) {
      return null;
    }

    const date = new Date(stringValue);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
