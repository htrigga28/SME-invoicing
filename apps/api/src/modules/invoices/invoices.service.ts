import { randomBytes } from "crypto";
import {
  BadRequestException,
  BadGatewayException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  sql,
  type SQL
} from "drizzle-orm";

import type { ActiveOrganisationContext } from "../../common/types/request-context";
import { assertInvoiceQuantity, assertKoboAmount } from "../../common/money-limits";
import { DatabaseService } from "../../database/database.service";
import {
  businessProfiles,
  auditLogs,
  customers,
  invoiceLineItems,
  invoiceStatusEvents,
  invoices,
  organisationPaymentAccounts,
  organisations,
  paymentEvents,
  paymentRefunds,
  payments,
  receipts,
  users,
  type BusinessProfile,
  type Customer,
  type Invoice,
  type InvoiceLineItem,
  type InvoiceStatusEvent,
  type OrganisationPaymentAccount,
  type Payment,
  type Receipt
} from "../../database/schema";
import { AuditLogService } from "../audit-log/audit-log.service";
import {
  CommunicationsService,
  type DeliveryState
} from "../communications/communications.service";
import { validateSendRecipients } from "../communications/email-provider";
import type { SendInvoiceEmailDto } from "../communications/dto/send-invoice-email.dto";
import { PaymentsService } from "../payments/payments.service";
import { PaystackService } from "../paystack/paystack.service";
import type { CreateInvoiceDto } from "./dto/create-invoice.dto";
import type { InvoiceLineItemDto } from "./dto/invoice-line-item.dto";
import type { ListInvoicesQueryDto } from "./dto/list-invoices-query.dto";
import type { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { displayInvoiceStatus } from "./invoice-status";

type PaginationInput = {
  page?: number;
  limit?: number;
};

type InvoiceStatusValue = Invoice["status"];

type InvoiceWithCustomer = {
  customer: Customer;
  invoice: Invoice;
};

type PublicInvoiceRow = InvoiceWithCustomer & {
  businessProfile: BusinessProfile | null;
  organisation: {
    name: string;
  };
};

type PaymentAvailabilityAccount = {
  disabledAt: Date | null;
  id: string;
  providerSubaccountCode: string | null;
  status: "pending_confirmation" | "active" | "verification_delayed" | "disabled";
};

type PaymentSummary =
  | {
      amountKobo: number;
      available: true;
      currency: "NGN";
      message: string;
      provider: "paystack";
    }
  | {
      available: false;
      message: string;
      reason:
        | "invoice_unavailable"
        | "no_outstanding_balance"
        | "payment_setup_disabled"
        | "payment_setup_incomplete"
        | "payment_setup_pending"
        | "payment_unavailable";
    };

type SequenceExecutor = {
  execute: <TRow extends Record<string, unknown>>(query: SQL) => Promise<{ rows: TRow[] }>;
};

const editableStatuses: InvoiceStatusValue[] = ["draft"];
const cancelableStatuses: InvoiceStatusValue[] = ["draft", "sent", "viewed", "overdue"];
const voidableStatuses: InvoiceStatusValue[] = ["draft", "sent", "viewed", "overdue", "cancelled"];

function calculateInvoiceTotals(input: {
  discountKobo?: number;
  lineItems: { quantity: number; unitPriceKobo: number }[];
  taxKobo?: number;
}) {
  const lineTotalsKobo = input.lineItems.map((item) =>
    assertKoboAmount(Math.round(item.quantity * item.unitPriceKobo), "Line total")
  );
  const subtotalKobo = lineTotalsKobo.reduce(
    (sum, lineTotal) => assertKoboAmount(sum + lineTotal, "Invoice subtotal"),
    0
  );
  const discountKobo = assertKoboAmount(input.discountKobo ?? 0, "Discount");
  const taxKobo = assertKoboAmount(input.taxKobo ?? 0, "Tax");
  const totalKobo = assertKoboAmount(subtotalKobo - discountKobo + taxKobo, "Invoice total");

  return {
    lineTotalsKobo,
    subtotalKobo,
    discountKobo,
    taxKobo,
    totalKobo,
    amountPaidKobo: 0,
    balanceDueKobo: totalKobo
  };
}

function formatInvoiceNumber(sequenceNumber: number) {
  return `INV-${sequenceNumber.toString().padStart(6, "0")}`;
}

export type InvoiceActivityTone = "neutral" | "success" | "warning" | "danger" | "info";

export type InvoiceActivityType =
  | "invoice_created"
  | "invoice_edited"
  | "invoice_sent"
  | "email_accepted"
  | "email_delivered"
  | "email_deferred"
  | "email_failed"
  | "invoice_viewed"
  | "payment_started"
  | "payment_confirmed"
  | "reconciliation_matched"
  | "reconciliation_review"
  | "refund_requested"
  | "refund_processed"
  | "receipt_issued"
  | "invoice_cancelled"
  | "invoice_voided";

export type InvoiceActivityItem = {
  id: string;
  type: InvoiceActivityType;
  occurredAt: string;
  title: string;
  detail?: string;
  tone?: InvoiceActivityTone;
  actor?: { name?: string } | null;
  metadata?: Record<string, string | number | null>;
};

@Injectable()
export class InvoicesService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(PaystackService) private readonly paystackService: PaystackService,
    @Inject(PaymentsService) private readonly paymentsService: PaymentsService,
    @Inject(CommunicationsService) private readonly communicationsService: CommunicationsService
  ) {}

  async getInvoiceActivity(context: ActiveOrganisationContext, invoiceId: string) {
    const invoiceWithCustomer = await this.requireInvoice(context.activeOrganisation.id, invoiceId);
    const organisationId = context.activeOrganisation.id;

    const [statusEvents, auditRows, delivery, invoicePayments] = await Promise.all([
      this.findStatusEvents(organisationId, invoiceId),
      this.findInvoiceAuditRows(organisationId, invoiceId),
      this.communicationsService.listCommunicationsForInvoice(organisationId, invoiceId),
      this.findPaymentsForInvoice(organisationId, invoiceId)
    ]);

    const refunds =
      invoicePayments.length === 0
        ? []
        : await this.databaseService.db
            .select()
            .from(paymentRefunds)
            .where(inArray(paymentRefunds.paymentId, invoicePayments.map((item) => item.id)))
            .orderBy(desc(paymentRefunds.createdAt));

    const items: InvoiceActivityItem[] = [];
    const push = (item: Omit<InvoiceActivityItem, "id"> & { id: string }) => {
      items.push({ ...item, metadata: item.metadata ?? {} });
    };

    for (const event of statusEvents) {
      if (event.toStatus === "draft" && event.reason === "invoice_created") {
        push({
          id: `status-${event.id}`,
          type: "invoice_created",
          occurredAt: event.createdAt.toISOString(),
          title: "Invoice created",
          detail: `Draft ${invoiceWithCustomer.invoice.invoiceNumber} created.`,
          tone: "info",
          actor: null,
          metadata: { invoiceNumber: invoiceWithCustomer.invoice.invoiceNumber }
        });
      } else if (event.toStatus === "sent" && event.reason === "invoice_sent") {
        push({
          id: `status-${event.id}`,
          type: "invoice_sent",
          occurredAt: event.createdAt.toISOString(),
          title: "Invoice sent",
          detail: "Invoice issued and public access enabled.",
          tone: "success",
          actor: null,
          metadata: { invoiceNumber: invoiceWithCustomer.invoice.invoiceNumber }
        });
      } else if (event.toStatus === "cancelled") {
        push({
          id: `status-${event.id}`,
          type: "invoice_cancelled",
          occurredAt: event.createdAt.toISOString(),
          title: "Invoice cancelled",
          tone: "warning",
          actor: null,
          metadata: { invoiceNumber: invoiceWithCustomer.invoice.invoiceNumber }
        });
      } else if (event.toStatus === "void") {
        push({
          id: `status-${event.id}`,
          type: "invoice_voided",
          occurredAt: event.createdAt.toISOString(),
          title: "Invoice voided",
          tone: "danger",
          actor: null,
          metadata: { invoiceNumber: invoiceWithCustomer.invoice.invoiceNumber }
        });
      }
    }

    for (const row of auditRows) {
      if (row.auditLog.action !== "invoice_updated") {
        continue;
      }

      push({
        id: `audit-${row.auditLog.id}`,
        type: "invoice_edited",
        occurredAt: row.auditLog.createdAt.toISOString(),
        title: "Invoice edited",
        detail: "Draft details updated before sending.",
        tone: "info",
        actor: row.actor ? { name: row.actor.name } : null,
        metadata: { invoiceNumber: invoiceWithCustomer.invoice.invoiceNumber }
      });
    }

    const orderedCommunications = [...delivery.communications].reverse();

    orderedCommunications.forEach((communication, index) => {
      const recipients = communication.toRecipients ?? [];
      const recipientLabel =
        recipients.length > 1
          ? `${recipients[0]} +${recipients.length - 1} more`
          : (recipients[0] ?? "customer");
      const resent = index > 0;
      const metadata = {
        invoiceNumber: invoiceWithCustomer.invoice.invoiceNumber,
        communicationId: communication.id
      };

      if (communication.acceptedAt) {
        push({
          id: `email-${communication.id}-accepted`,
          type: "email_accepted",
          occurredAt: new Date(communication.acceptedAt).toISOString(),
          title: resent ? `Invoice email resent to ${recipientLabel}` : `Invoice emailed to ${recipientLabel}`,
          detail: "Accepted by the email provider.",
          tone: "info",
          actor: null,
          metadata
        });
      }

      if (communication.deliveredAt) {
        push({
          id: `email-${communication.id}-delivered`,
          type: "email_delivered",
          occurredAt: new Date(communication.deliveredAt).toISOString(),
          title: "Email delivered",
          detail: `Delivered to ${recipientLabel}.`,
          tone: "success",
          actor: null,
          metadata
        });
      }

      if (communication.deferredAt) {
        push({
          id: `email-${communication.id}-deferred`,
          type: "email_deferred",
          occurredAt: new Date(communication.deferredAt).toISOString(),
          title: "Email delivery delayed",
          detail: "The provider deferred delivery. It may still arrive.",
          tone: "warning",
          actor: null,
          metadata
        });
      }

      if (communication.failedAt) {
        push({
          id: `email-${communication.id}-failed`,
          type: "email_failed",
          occurredAt: new Date(communication.failedAt).toISOString(),
          title: "Email delivery failed",
          detail: communication.failureReason ?? "The email could not be delivered.",
          tone: "danger",
          actor: null,
          metadata
        });
      }
    });

    const viewSummary = this.toViewSummary(invoiceWithCustomer.invoice);

    if (viewSummary && viewSummary.viewCount > 0) {
      const lastViewed = viewSummary.lastViewedAt ?? viewSummary.firstViewedAt;
      push({
        id: "view-summary",
        type: "invoice_viewed",
        occurredAt: new Date(lastViewed ?? Date.now()).toISOString(),
        title: "Invoice viewed",
        detail: this.formatViewSummaryDetail(viewSummary.viewCount, viewSummary.firstViewedAt, viewSummary.lastViewedAt),
        tone: "info",
        actor: null,
        metadata: {
          invoiceNumber: invoiceWithCustomer.invoice.invoiceNumber,
          viewCount: viewSummary.viewCount
        }
      });
    }

    for (const payment of invoicePayments) {
      const amountLabel = this.formatKobo(payment.amountKobo);
      const paymentMetadata = {
        invoiceNumber: invoiceWithCustomer.invoice.invoiceNumber,
        providerReference: payment.providerReference,
        amountKobo: payment.amountKobo
      };

      push({
        id: `payment-${payment.id}-started`,
        type: "payment_started",
        occurredAt: new Date(payment.initializedAt ?? payment.createdAt).toISOString(),
        title: "Payment started",
        detail: `${amountLabel} · Paystack checkout initialized.`,
        tone: "info",
        actor: null,
        metadata: paymentMetadata
      });

      if (payment.paidAt) {
        push({
          id: `payment-${payment.id}-confirmed`,
          type: "payment_confirmed",
          occurredAt: new Date(payment.paidAt).toISOString(),
          title: "Payment confirmed",
          detail: `${payment.providerReference} · provider-confirmed.`,
          tone: "success",
          actor: null,
          metadata: paymentMetadata
        });
      }

      if (payment.reconciliationState === "matched" && payment.paidAt) {
        push({
          id: `payment-${payment.id}-matched`,
          type: "reconciliation_matched",
          occurredAt: new Date(payment.paidAt).toISOString(),
          title: "Payment matched",
          detail: `Reference resolved to ${invoiceWithCustomer.invoice.invoiceNumber}.`,
          tone: "success",
          actor: null,
          metadata: paymentMetadata
        });
      } else if (payment.reconciliationState === "review_required") {
        push({
          id: `payment-${payment.id}-review`,
          type: "reconciliation_review",
          occurredAt: new Date(payment.paidAt ?? payment.createdAt).toISOString(),
          title: "Payment needs review",
          detail: "A reconciliation exception needs a manual decision.",
          tone: "warning",
          actor: null,
          metadata: paymentMetadata
        });
      }

      if (payment.receipt?.issuedAt) {
        push({
          id: `payment-${payment.id}-receipt`,
          type: "receipt_issued",
          occurredAt: new Date(payment.receipt.issuedAt).toISOString(),
          title: `Receipt ${payment.receipt.receiptNumber} issued`,
          detail: "Immutable receipt for the confirmed payment.",
          tone: "success",
          actor: null,
          metadata: { ...paymentMetadata, receiptNumber: payment.receipt.receiptNumber }
        });
      }
    }

    for (const refund of refunds) {
      const metadata = {
        invoiceNumber: invoiceWithCustomer.invoice.invoiceNumber,
        amountKobo: refund.amountKobo
      };

      if (refund.status === "processed") {
        push({
          id: `refund-${refund.id}-processed`,
          type: "refund_processed",
          occurredAt: new Date(refund.processedAt ?? refund.createdAt).toISOString(),
          title: "Refund processed",
          detail: `${this.formatKobo(refund.amountKobo)} returned via Paystack.`,
          tone: "info",
          actor: null,
          metadata
        });
      } else {
        push({
          id: `refund-${refund.id}-requested`,
          type: "refund_requested",
          occurredAt: new Date(refund.createdAt).toISOString(),
          title: "Refund requested",
          detail:
            refund.status === "pending" || refund.status === "processing"
              ? `${this.formatKobo(refund.amountKobo)} refund in progress.`
              : `${this.formatKobo(refund.amountKobo)} refund needs attention.`,
          tone: refund.status === "pending" || refund.status === "processing" ? "warning" : "danger",
          actor: null,
          metadata
        });
      }
    }

    items.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0));

    return {
      activity: items.slice(0, 200),
      viewSummary
    };
  }

  private async findInvoiceAuditRows(organisationId: string, invoiceId: string) {
    return this.databaseService.db
      .select({ auditLog: auditLogs, actor: { name: users.name } })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorUserId))
      .where(
        and(
          eq(auditLogs.organisationId, organisationId),
          eq(auditLogs.entityType, "invoice"),
          eq(auditLogs.entityId, invoiceId)
        )
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);
  }

  private formatViewSummaryDetail(
    viewCount: number,
    firstViewedAt: Date | string | null,
    lastViewedAt: Date | string | null
  ): string {
    const formatDateTime = (value: Date | string) =>
      new Date(value).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
    const times = viewCount === 1 ? "time" : "times";

    if (firstViewedAt && lastViewedAt && viewCount > 1) {
      return `Viewed ${viewCount} ${times} · first ${formatDateTime(firstViewedAt)} · last ${formatDateTime(lastViewedAt)}`;
    }

    if (firstViewedAt) {
      return `Viewed ${viewCount} ${times} · first ${formatDateTime(firstViewedAt)}`;
    }

    return `Viewed ${viewCount} ${times}`;
  }

  private formatKobo(amountKobo: number): string {
    return `₦${(amountKobo / 100).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  async listInvoices(context: ActiveOrganisationContext, query: ListInvoicesQueryDto) {
    const pagination = this.getPagination(query);
    const conditions = [eq(invoices.organisationId, context.activeOrganisation.id)];

    if (query.status) {
      conditions.push(eq(invoices.status, query.status));
    }

    if (query.customerId) {
      conditions.push(eq(invoices.customerId, query.customerId));
    }

    if (query.issueDateFrom) {
      conditions.push(gte(invoices.issueDate, query.issueDateFrom));
    }

    if (query.issueDateTo) {
      conditions.push(lte(invoices.issueDate, query.issueDateTo));
    }

    if (query.dueDateFrom) {
      conditions.push(gte(invoices.dueDate, query.dueDateFrom));
    }

    if (query.dueDateTo) {
      conditions.push(lte(invoices.dueDate, query.dueDateTo));
    }

    const search = query.search?.trim();

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(invoices.invoiceNumber, pattern),
          ilike(customers.name, pattern),
          ilike(customers.email, pattern)
        )!
      );
    }

    const whereClause = and(...conditions);
    const rows = await this.databaseService.db
      .select({ invoice: invoices, customer: customers })
      .from(invoices)
      .innerJoin(customers, eq(customers.id, invoices.customerId))
      .where(whereClause)
      .orderBy(desc(invoices.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset);

    const [countRow] = await this.databaseService.db
      .select({ total: count() })
      .from(invoices)
      .innerJoin(customers, eq(customers.id, invoices.customerId))
      .where(whereClause);

    return {
      invoices: rows.map((row) => this.toSafeInvoiceListItem(row.invoice, row.customer)),
      pagination: this.toPaginationResponse(pagination, countRow?.total ?? 0)
    };
  }

  async createInvoice(context: ActiveOrganisationContext, input: CreateInvoiceDto) {
    const customer = await this.findCustomerForInvoice(
      context.activeOrganisation.id,
      input.customerId
    );
    const normalized = this.normalizeInvoiceInput(input);
    const totals = this.calculateAndValidateTotals(normalized.lineItems, {
      discountKobo: normalized.discountKobo,
      taxKobo: normalized.taxKobo
    });

    const created = await this.databaseService.db.transaction(async (tx) => {
      const sequenceNumber = await this.nextInvoiceSequenceNumber(
        tx as SequenceExecutor,
        context.activeOrganisation.id
      );
      const invoiceNumber = formatInvoiceNumber(sequenceNumber);
      const publicToken = this.generatePublicToken();

      const [invoice] = await tx
        .insert(invoices)
        .values({
          organisationId: context.activeOrganisation.id,
          customerId: customer.id,
          invoiceNumber,
          publicToken,
          status: "draft",
          publicAccessEnabled: false,
          currency: "NGN",
          issueDate: normalized.issueDate,
          dueDate: normalized.dueDate,
          customerReference: normalized.customerReference,
          notes: normalized.notes,
          subtotalKobo: totals.subtotalKobo,
          discountKobo: totals.discountKobo,
          taxKobo: totals.taxKobo,
          totalKobo: totals.totalKobo,
          amountPaidKobo: totals.amountPaidKobo,
          balanceDueKobo: totals.balanceDueKobo,
          createdByUserId: context.user.id
        })
        .returning();

      if (!invoice) {
        throw new Error("Invoice creation failed.");
      }

      await tx.insert(invoiceLineItems).values(
        normalized.lineItems.map((lineItem, index) => ({
          organisationId: context.activeOrganisation.id,
          invoiceId: invoice.id,
          description: lineItem.description,
          quantity: lineItem.quantity.toFixed(2),
          unitPriceKobo: lineItem.unitPriceKobo,
          lineTotalKobo: totals.lineTotalsKobo[index] ?? 0,
          sortOrder: index
        }))
      );

      await tx.insert(invoiceStatusEvents).values({
        organisationId: context.activeOrganisation.id,
        invoiceId: invoice.id,
        fromStatus: null,
        toStatus: "draft",
        reason: "invoice_created",
        actorUserId: context.user.id,
        metadataRedacted: { invoiceNumber }
      });

      await tx.insert(auditLogs).values({
        organisationId: context.activeOrganisation.id,
        actorUserId: context.user.id,
        action: "invoice_created",
        entityType: "invoice",
        entityId: invoice.id,
        metadataRedacted: { invoiceNumber, customerId: customer.id, totalKobo: totals.totalKobo }
      });

      return invoice;
    });

    return this.getInvoice(context, created.id);
  }

  async getInvoice(context: ActiveOrganisationContext, invoiceId: string) {
    const invoiceWithCustomer = await this.findInvoiceWithCustomer(
      context.activeOrganisation.id,
      invoiceId
    );

    if (!invoiceWithCustomer) {
      throw new NotFoundException("Invoice was not found.");
    }

    const [lineItems, statusEvents, invoicePayments, financialSummary, deliverySummary] =
      await Promise.all([
        this.findLineItems(context.activeOrganisation.id, invoiceId),
        this.findStatusEvents(context.activeOrganisation.id, invoiceId),
        this.findPaymentsForInvoice(context.activeOrganisation.id, invoiceId),
        this.paymentsService.getInvoiceFinancialSummary(context.activeOrganisation.id, invoiceId),
        this.communicationsService.getDeliverySummary(context.activeOrganisation.id, invoiceId)
      ]);

    const paymentAccount = await this.findPaymentAvailabilityAccount(context.activeOrganisation.id);
    const paymentSummary = this.toAuthenticatedPaymentSummary(
      invoiceWithCustomer.invoice,
      paymentAccount
    );

    return {
      invoice: this.toSafeInvoiceDetail(invoiceWithCustomer.invoice, invoiceWithCustomer.customer),
      lineItems: lineItems.map((lineItem) => this.toSafeLineItem(lineItem)),
      statusEvents: statusEvents.map((event) => this.toSafeStatusEvent(event)),
      payments: invoicePayments,
      financialSummary,
      delivery: this.toDeliveryResponse(deliverySummary),
      viewSummary: this.toViewSummary(invoiceWithCustomer.invoice),
      publicUrl: invoiceWithCustomer.invoice.publicAccessEnabled
        ? this.createPublicInvoiceUrl(invoiceWithCustomer.invoice.publicToken)
        : null,
      paymentSummary
    };
  }

  async updateInvoice(
    context: ActiveOrganisationContext,
    invoiceId: string,
    input: UpdateInvoiceDto
  ) {
    const invoiceWithCustomer = await this.findInvoiceWithCustomer(
      context.activeOrganisation.id,
      invoiceId
    );

    if (!invoiceWithCustomer) {
      throw new NotFoundException("Invoice was not found.");
    }

    if (!editableStatuses.includes(invoiceWithCustomer.invoice.status)) {
      throw new UnprocessableEntityException("Only draft invoices can be edited.");
    }

    const normalized = this.normalizeInvoiceUpdateInput(input, invoiceWithCustomer.invoice);
    const nextCustomer =
      normalized.customerId && normalized.customerId !== invoiceWithCustomer.invoice.customerId
        ? await this.findCustomerForInvoice(context.activeOrganisation.id, normalized.customerId)
        : invoiceWithCustomer.customer;
    const nextLineItems =
      normalized.lineItems ?? (await this.findLineItems(context.activeOrganisation.id, invoiceId));
    const lineItemInput = nextLineItems.map((lineItem) => ({
      description: lineItem.description,
      quantity:
        typeof lineItem.quantity === "number" ? lineItem.quantity : Number(lineItem.quantity),
      unitPriceKobo: lineItem.unitPriceKobo
    }));
    const totals = this.calculateAndValidateTotals(lineItemInput, {
      discountKobo: normalized.discountKobo,
      taxKobo: normalized.taxKobo
    });

    await this.databaseService.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(invoices)
        .set({
          customerId: nextCustomer.id,
          issueDate: normalized.issueDate,
          dueDate: normalized.dueDate,
          customerReference: normalized.customerReference,
          notes: normalized.notes,
          subtotalKobo: totals.subtotalKobo,
          discountKobo: totals.discountKobo,
          taxKobo: totals.taxKobo,
          totalKobo: totals.totalKobo,
          amountPaidKobo: totals.amountPaidKobo,
          balanceDueKobo: totals.balanceDueKobo,
          updatedAt: new Date()
        })
        .where(eq(invoices.id, invoiceWithCustomer.invoice.id))
        .returning();

      if (!updated) {
        throw new Error("Invoice update failed.");
      }

      if (normalized.lineItems) {
        await tx.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId));
        await tx.insert(invoiceLineItems).values(
          normalized.lineItems.map((lineItem, index) => ({
            organisationId: context.activeOrganisation.id,
            invoiceId,
            description: lineItem.description,
            quantity: lineItem.quantity.toFixed(2),
            unitPriceKobo: lineItem.unitPriceKobo,
            lineTotalKobo: totals.lineTotalsKobo[index] ?? 0,
            sortOrder: index
          }))
        );
      }

      await tx.insert(auditLogs).values({
        organisationId: context.activeOrganisation.id,
        actorUserId: context.user.id,
        action: "invoice_updated",
        entityType: "invoice",
        entityId: invoiceId,
        metadataRedacted: {
          invoiceNumber: invoiceWithCustomer.invoice.invoiceNumber,
          totalKobo: totals.totalKobo
        }
      });
    });

    return this.getInvoice(context, invoiceId);
  }

  async sendInvoice(
    context: ActiveOrganisationContext,
    invoiceId: string,
    email?: SendInvoiceEmailDto
  ) {
    const invoiceWithCustomer = await this.requireInvoice(context.activeOrganisation.id, invoiceId);

    if (invoiceWithCustomer.invoice.status !== "draft") {
      throw new UnprocessableEntityException("Only draft invoices can be sent.");
    }

    const recipients = this.resolveSendRecipients(invoiceWithCustomer.customer, email);

    const sentAt = new Date();
    await this.transitionInvoice(context, invoiceWithCustomer.invoice, {
      action: "invoice_sent",
      metadata: { invoiceNumber: invoiceWithCustomer.invoice.invoiceNumber },
      patch: {
        publicAccessEnabled: true,
        sentAt,
        status: "sent",
        updatedAt: sentAt
      },
      reason: "invoice_sent",
      toStatus: "sent"
    });

    const publicUrl = this.createPublicInvoiceUrl(invoiceWithCustomer.invoice.publicToken);
    const delivery = await this.deliverIssuedInvoiceEmail({
      context,
      invoice: invoiceWithCustomer.invoice,
      customer: invoiceWithCustomer.customer,
      publicUrl,
      recipients,
      subject: email?.subject
    });

    const response = await this.getInvoice(context, invoiceId);
    return {
      ...response,
      publicUrl,
      delivery
    };
  }

  async resendInvoiceEmail(
    context: ActiveOrganisationContext,
    invoiceId: string,
    email: SendInvoiceEmailDto
  ) {
    const invoiceWithCustomer = await this.requireInvoice(context.activeOrganisation.id, invoiceId);

    if (
      !invoiceWithCustomer.invoice.publicAccessEnabled ||
      ["draft", "cancelled", "void"].includes(invoiceWithCustomer.invoice.status)
    ) {
      throw new UnprocessableEntityException("Only issued invoices can be emailed.");
    }

    const recipients = this.resolveSendRecipients(invoiceWithCustomer.customer, email, true);

    const delivery = await this.deliverIssuedInvoiceEmail({
      context,
      invoice: invoiceWithCustomer.invoice,
      customer: invoiceWithCustomer.customer,
      publicUrl: this.createPublicInvoiceUrl(invoiceWithCustomer.invoice.publicToken),
      recipients,
      subject: email?.subject
    });

    return { delivery };
  }

  private resolveSendRecipients(
    customer: Customer,
    email: SendInvoiceEmailDto | undefined,
    requireExplicit = false
  ): { to: string[]; cc: string[] } {
    const to = email?.to ?? (requireExplicit ? [] : customer.email ? [customer.email] : []);
    const cc = email?.cc ?? [];

    try {
      return validateSendRecipients(to, cc);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Recipients are invalid."
      );
    }
  }

  private async deliverIssuedInvoiceEmail(input: {
    context: ActiveOrganisationContext;
    invoice: Invoice;
    customer: Customer;
    publicUrl: string;
    recipients: { to: string[]; cc: string[] };
    subject?: string | undefined;
  }) {
    const businessProfile = input.context.businessProfile;

    try {
      await this.communicationsService.sendInvoiceEmail({
        organisationId: input.context.activeOrganisation.id,
        userId: input.context.user.id,
        invoice: { id: input.invoice.id, invoiceNumber: input.invoice.invoiceNumber },
        customerId: input.customer.id,
        content: {
          customerEmail: input.customer.email,
          customerName: input.customer.name,
          businessName:
            businessProfile?.businessName ?? input.context.activeOrganisation.name,
          businessEmail: businessProfile?.email ?? null,
          invoiceNumber: input.invoice.invoiceNumber,
          amountDueKobo: input.invoice.balanceDueKobo,
          dueDate: this.formatDueDate(input.invoice.dueDate),
          publicUrl: input.publicUrl,
          to: input.recipients.to,
          cc: input.recipients.cc,
          subject: input.subject
        }
      });
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        return this.toDeliveryResponse(
          await this.communicationsService.getDeliverySummary(
            input.context.activeOrganisation.id,
            input.invoice.id
          ),
          "Email delivery is not configured. The invoice is issued and the public link can still be shared."
        );
      }

      if (error instanceof BadGatewayException) {
        return this.toDeliveryResponse(
          await this.communicationsService.getDeliverySummary(
            input.context.activeOrganisation.id,
            input.invoice.id
          ),
          "Invoice issued, but the email could not be sent. Copy the public link or try again."
        );
      }

      throw error;
    }

    return this.toDeliveryResponse(
      await this.communicationsService.getDeliverySummary(
        input.context.activeOrganisation.id,
        input.invoice.id
      )
    );
  }

  private toDeliveryResponse(
    summary: {
      state: DeliveryState;
      attempts: number;
      lastCommunication: ReturnType<CommunicationsService["toSafeCommunication"]> | null;
    },
    message?: string
  ) {
    const defaultMessages: Record<DeliveryState, string> = {
      not_emailed: "This invoice has not been emailed.",
      sending: "Email is being sent.",
      accepted: "Email accepted by the email provider.",
      delivered: "Email delivered.",
      delayed: "Email delivery is delayed.",
      failed: "Email delivery failed."
    };

    return {
      state: summary.state,
      message: message ?? defaultMessages[summary.state],
      attempts: summary.attempts,
      lastCommunication: summary.lastCommunication
    };
  }

  private toViewSummary(invoice: Invoice) {
    if (!invoice.viewCount && !invoice.viewedAt && !invoice.lastViewedAt) {
      return null;
    }

    return {
      viewCount: invoice.viewCount,
      firstViewedAt: invoice.viewedAt,
      lastViewedAt: invoice.lastViewedAt
    };
  }

  private formatDueDate(dueDate: string): string {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(new Date(`${dueDate}T00:00:00.000Z`));
  }

  async duplicateInvoice(context: ActiveOrganisationContext, invoiceId: string) {
    const source = await this.requireInvoice(context.activeOrganisation.id, invoiceId);

    if (source.customer.archivedAt) {
      throw new UnprocessableEntityException(
        "Archived customers cannot be used for duplicated invoices. Reactivate the customer or choose an active customer."
      );
    }

    const sourceLineItems = await this.findLineItems(context.activeOrganisation.id, invoiceId);
    const issueDate = new Date().toISOString().slice(0, 10);

    return this.createInvoice(context, {
      customerId: source.invoice.customerId,
      issueDate,
      dueDate: this.duplicateDueDate(issueDate, source.invoice.issueDate, source.invoice.dueDate),
      notes: source.invoice.notes,
      discountKobo: source.invoice.discountKobo,
      taxKobo: source.invoice.taxKobo,
      lineItems: sourceLineItems.map((lineItem) => ({
        description: lineItem.description,
        quantity: Number(lineItem.quantity),
        unitPriceKobo: lineItem.unitPriceKobo
      }))
    });
  }

  async cancelInvoice(context: ActiveOrganisationContext, invoiceId: string, reason: string) {
    const trimmedReason = this.requiredReason(reason);
    const invoiceWithCustomer = await this.requireInvoice(context.activeOrganisation.id, invoiceId);

    if (!cancelableStatuses.includes(invoiceWithCustomer.invoice.status)) {
      throw new UnprocessableEntityException("This invoice cannot be cancelled.");
    }

    const cancelledAt = new Date();
    await this.transitionInvoice(context, invoiceWithCustomer.invoice, {
      action: "invoice_cancelled",
      metadata: { invoiceNumber: invoiceWithCustomer.invoice.invoiceNumber, reason: trimmedReason },
      patch: {
        cancelledAt,
        status: "cancelled",
        updatedAt: cancelledAt
      },
      reason: trimmedReason,
      toStatus: "cancelled"
    });

    return this.getInvoice(context, invoiceId);
  }

  async voidInvoice(context: ActiveOrganisationContext, invoiceId: string, reason: string) {
    const trimmedReason = this.requiredReason(reason);
    const invoiceWithCustomer = await this.requireInvoice(context.activeOrganisation.id, invoiceId);

    if (!voidableStatuses.includes(invoiceWithCustomer.invoice.status)) {
      throw new UnprocessableEntityException("This invoice cannot be voided.");
    }

    const voidedAt = new Date();
    await this.transitionInvoice(context, invoiceWithCustomer.invoice, {
      action: "invoice_voided",
      metadata: { invoiceNumber: invoiceWithCustomer.invoice.invoiceNumber, reason: trimmedReason },
      patch: {
        publicAccessEnabled: false,
        status: "void",
        updatedAt: voidedAt,
        voidedAt
      },
      reason: trimmedReason,
      toStatus: "void"
    });

    return this.getInvoice(context, invoiceId);
  }

  async getPublicInvoice(publicToken: string) {
    const publicInvoice = await this.requirePublicInvoice(publicToken);
    const [lineItems, paymentAccount] = await Promise.all([
      this.findLineItems(publicInvoice.invoice.organisationId, publicInvoice.invoice.id),
      this.findPaymentAvailabilityAccount(publicInvoice.invoice.organisationId)
    ]);

    return this.toPublicInvoiceResponse(publicInvoice, lineItems, paymentAccount);
  }

  async markPublicInvoiceViewed(publicToken: string) {
    const publicInvoice = await this.requirePublicInvoice(publicToken);
    const displayStatus = this.displayStatus(publicInvoice.invoice);

    const { occurredAt, viewCount } = await this.communicationsService.recordInvoiceViewEvent(
      publicInvoice.invoice.organisationId,
      publicInvoice.invoice.id
    );

    if (publicInvoice.invoice.status !== "sent" || displayStatus === "overdue") {
      return {
        success: true,
        viewCount,
        firstViewedAt: publicInvoice.invoice.viewedAt,
        lastViewedAt: occurredAt
      };
    }

    const viewedAt = publicInvoice.invoice.viewedAt ?? occurredAt;

    await this.databaseService.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(invoices)
        .set({
          status: "viewed",
          viewedAt,
          updatedAt: viewedAt
        })
        .where(and(eq(invoices.id, publicInvoice.invoice.id), eq(invoices.status, "sent")))
        .returning();

      if (!updated) {
        return;
      }

      await tx.insert(invoiceStatusEvents).values({
        organisationId: publicInvoice.invoice.organisationId,
        invoiceId: publicInvoice.invoice.id,
        fromStatus: "sent",
        toStatus: "viewed",
        reason: "invoice_viewed",
        actorUserId: null,
        metadataRedacted: {
          invoiceNumber: publicInvoice.invoice.invoiceNumber,
          source: "public_invoice_page"
        }
      });

      await tx.insert(auditLogs).values({
        organisationId: publicInvoice.invoice.organisationId,
        actorUserId: null,
        action: "invoice_viewed",
        entityType: "invoice",
        entityId: publicInvoice.invoice.id,
        metadataRedacted: {
          invoiceNumber: publicInvoice.invoice.invoiceNumber,
          source: "public_invoice_page"
        }
      });
    });

    return { success: true, viewCount, firstViewedAt: viewedAt, lastViewedAt: viewedAt };
  }

  async initializePublicInvoicePayment(publicToken: string) {
    const publicInvoice = await this.requirePublicInvoice(publicToken);
    this.assertInvoicePayable(publicInvoice.invoice, publicInvoice.customer);
    const paymentAccount = await this.requireActivePaymentAccount(
      publicInvoice.invoice.organisationId
    );

    const amountKobo = assertKoboAmount(publicInvoice.invoice.balanceDueKobo, "Payment amount", 1);
    const reference = this.generatePaymentReference(publicInvoice.invoice.invoiceNumber);
    const callbackUrl = this.createPaymentCallbackUrl(publicToken, reference);
    const initializedAt = new Date();
    const metadata = {
      invoiceId: publicInvoice.invoice.id,
      invoiceNumber: publicInvoice.invoice.invoiceNumber,
      customerId: publicInvoice.customer.id,
      organisationId: publicInvoice.invoice.organisationId,
      providerSubaccountCode: paymentAccount.providerSubaccountCode,
      source: "public_invoice_page"
    };

    const [payment] = await this.databaseService.db
      .insert(payments)
      .values({
        organisationId: publicInvoice.invoice.organisationId,
        invoiceId: publicInvoice.invoice.id,
        customerId: publicInvoice.customer.id,
        provider: "paystack",
        providerReference: reference,
        providerSubaccountCode: paymentAccount.providerSubaccountCode,
        status: "pending",
        currency: "NGN",
        amountKobo,
        initializedAt,
        metadataRedacted: metadata
      })
      .returning();

    if (!payment) {
      throw new Error("Payment initialization record could not be created.");
    }

    try {
      const paystackResponse = await this.paystackService.initializeTransaction({
        email: publicInvoice.customer.email,
        amountKobo,
        subaccount: paymentAccount.providerSubaccountCode,
        bearer: "subaccount",
        currency: "NGN",
        reference,
        callbackUrl,
        metadata: {
          ...metadata,
          paymentId: payment.id
        }
      });

      const [updatedPayment] = await this.databaseService.db
        .update(payments)
        .set({
          providerAccessCode: paystackResponse.accessCode,
          providerAuthorizationUrl: paystackResponse.authorizationUrl,
          metadataRedacted: {
            ...metadata,
            paymentId: payment.id
          },
          updatedAt: new Date()
        })
        .where(eq(payments.id, payment.id))
        .returning();

      if (!updatedPayment) {
        throw new Error("Payment initialization record could not be updated.");
      }

      await this.databaseService.db.insert(auditLogs).values({
        organisationId: publicInvoice.invoice.organisationId,
        actorUserId: null,
        action: "payment_initialized",
        entityType: "payment",
        entityId: payment.id,
        metadataRedacted: {
          invoiceNumber: publicInvoice.invoice.invoiceNumber,
          paymentId: payment.id,
          provider: "paystack",
          providerReference: reference,
          paymentAccountId: paymentAccount.id,
          amountKobo
        }
      });

      return {
        authorizationUrl: paystackResponse.authorizationUrl,
        accessCode: paystackResponse.accessCode,
        reference
      };
    } catch (error) {
      await this.markPaymentInitializationFailed(payment, error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadGatewayException("Payment initialization failed. Please try again later.");
    }
  }

  private async transitionInvoice(
    context: ActiveOrganisationContext,
    invoice: Invoice,
    input: {
      action: string;
      metadata: Record<string, unknown>;
      patch: Partial<Invoice>;
      reason: string;
      toStatus: InvoiceStatusValue;
    }
  ) {
    await this.databaseService.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(invoices)
        .set(input.patch)
        .where(eq(invoices.id, invoice.id))
        .returning();

      if (!updated) {
        throw new Error("Invoice transition failed.");
      }

      await tx.insert(invoiceStatusEvents).values({
        organisationId: context.activeOrganisation.id,
        invoiceId: invoice.id,
        fromStatus: invoice.status,
        toStatus: input.toStatus,
        reason: input.reason,
        actorUserId: context.user.id,
        metadataRedacted: input.metadata
      });

      await tx.insert(auditLogs).values({
        organisationId: context.activeOrganisation.id,
        actorUserId: context.user.id,
        action: input.action,
        entityType: "invoice",
        entityId: invoice.id,
        metadataRedacted: input.metadata
      });
    });
  }

  private async nextInvoiceSequenceNumber(tx: SequenceExecutor, organisationId: string) {
    const result = await tx.execute<{ sequence_number: number }>(sql`
      insert into invoice_number_sequences (organisation_id, next_number, updated_at)
      values (${organisationId}, 2, now())
      on conflict (organisation_id)
      do update set next_number = invoice_number_sequences.next_number + 1, updated_at = now()
      returning next_number - 1 as sequence_number
    `);
    const [row] = result.rows;

    if (!row) {
      throw new Error("Invoice number generation failed.");
    }

    return Number(row.sequence_number);
  }

  private async findCustomerForInvoice(organisationId: string, customerId: string) {
    const [customer] = await this.databaseService.db
      .select()
      .from(customers)
      .where(and(eq(customers.organisationId, organisationId), eq(customers.id, customerId)))
      .limit(1);

    if (!customer) {
      throw new NotFoundException("Customer was not found.");
    }

    if (customer.archivedAt) {
      throw new UnprocessableEntityException("Archived customers cannot be used for new invoices.");
    }

    return customer;
  }

  private async requireInvoice(organisationId: string, invoiceId: string) {
    const invoiceWithCustomer = await this.findInvoiceWithCustomer(organisationId, invoiceId);

    if (!invoiceWithCustomer) {
      throw new NotFoundException("Invoice was not found.");
    }

    return invoiceWithCustomer;
  }

  private async findInvoiceWithCustomer(organisationId: string, invoiceId: string) {
    const [row] = await this.databaseService.db
      .select({ invoice: invoices, customer: customers })
      .from(invoices)
      .innerJoin(customers, eq(customers.id, invoices.customerId))
      .where(and(eq(invoices.organisationId, organisationId), eq(invoices.id, invoiceId)))
      .limit(1);

    return row as InvoiceWithCustomer | undefined;
  }

  private async findPublicInvoice(publicToken: string) {
    const [row] = await this.databaseService.db
      .select({
        invoice: invoices,
        customer: customers,
        businessProfile: businessProfiles,
        organisation: {
          name: organisations.name
        }
      })
      .from(invoices)
      .innerJoin(customers, eq(customers.id, invoices.customerId))
      .innerJoin(organisations, eq(organisations.id, invoices.organisationId))
      .leftJoin(businessProfiles, eq(businessProfiles.organisationId, invoices.organisationId))
      .where(eq(invoices.publicToken, publicToken))
      .limit(1);

    return row as PublicInvoiceRow | undefined;
  }

  private async findPaymentAvailabilityAccount(
    organisationId: string
  ): Promise<PaymentAvailabilityAccount | null> {
    const [account] = await this.databaseService.db
      .select({
        id: organisationPaymentAccounts.id,
        providerSubaccountCode: organisationPaymentAccounts.providerSubaccountCode,
        status: organisationPaymentAccounts.status,
        disabledAt: organisationPaymentAccounts.disabledAt
      })
      .from(organisationPaymentAccounts)
      .where(
        and(
          eq(organisationPaymentAccounts.organisationId, organisationId),
          eq(organisationPaymentAccounts.provider, "paystack")
        )
      )
      .orderBy(
        sql`case ${organisationPaymentAccounts.status}
          when 'active' then 1
          when 'verification_delayed' then 2
          when 'pending_confirmation' then 3
          else 4
        end`,
        desc(organisationPaymentAccounts.updatedAt)
      )
      .limit(1);

    return account ?? null;
  }

  private async requireActivePaymentAccount(organisationId: string) {
    const [activeAccount] = await this.databaseService.db
      .select({
        id: organisationPaymentAccounts.id,
        providerSubaccountCode: organisationPaymentAccounts.providerSubaccountCode,
        status: organisationPaymentAccounts.status,
        disabledAt: organisationPaymentAccounts.disabledAt
      })
      .from(organisationPaymentAccounts)
      .where(
        and(
          eq(organisationPaymentAccounts.organisationId, organisationId),
          eq(organisationPaymentAccounts.provider, "paystack"),
          eq(organisationPaymentAccounts.status, "active"),
          isNull(organisationPaymentAccounts.disabledAt)
        )
      )
      .orderBy(desc(organisationPaymentAccounts.updatedAt))
      .limit(1);

    if (activeAccount?.providerSubaccountCode) {
      return {
        ...activeAccount,
        providerSubaccountCode: activeAccount.providerSubaccountCode
      };
    }

    const currentAccount =
      activeAccount ?? (await this.findPaymentAvailabilityAccount(organisationId));

    if (currentAccount?.status === "verification_delayed") {
      throw new ConflictException(
        "Online payments are not active for this business yet. Please try again later."
      );
    }

    if (currentAccount?.status === "disabled") {
      throw new ConflictException("Online payments are currently disabled for this business.");
    }

    throw new ConflictException("This business has not activated online payments yet.");
  }

  private async requirePublicInvoice(publicToken: string) {
    const publicInvoice = await this.findPublicInvoice(publicToken);

    if (!publicInvoice || !this.isPublicInvoiceAvailable(publicInvoice.invoice)) {
      throw new NotFoundException("Invoice is not available.");
    }

    return publicInvoice;
  }

  private isPublicInvoiceAvailable(invoice: Invoice) {
    return invoice.publicAccessEnabled && !["draft", "cancelled", "void"].includes(invoice.status);
  }

  private assertInvoicePayable(invoice: Invoice, customer: Customer) {
    const displayStatus = this.displayStatus(invoice);

    if (
      !invoice.publicAccessEnabled ||
      ["draft", "cancelled", "void", "paid"].includes(invoice.status)
    ) {
      throw new NotFoundException("Invoice is not available for payment.");
    }

    if (!["sent", "viewed", "overdue", "partially_paid"].includes(displayStatus)) {
      throw new UnprocessableEntityException("Online payment is unavailable for this invoice.");
    }

    if (invoice.balanceDueKobo <= 0) {
      throw new UnprocessableEntityException("This invoice has no outstanding balance.");
    }

    if (!customer.email) {
      throw new UnprocessableEntityException("This invoice customer cannot be paid online.");
    }
  }

  private async markPaymentInitializationFailed(payment: Payment, error: unknown) {
    await this.databaseService.db
      .update(payments)
      .set({
        status: "failed",
        failedAt: new Date(),
        gatewayResponse: this.safePaymentInitializationFailure(error),
        updatedAt: new Date()
      })
      .where(eq(payments.id, payment.id));
  }

  private safePaymentInitializationFailure(error: unknown) {
    if (error instanceof HttpException) {
      const message = error.message.trim();

      if (message && message.length <= 240 && !/[{}[\]<>]/.test(message)) {
        return message;
      }
    }

    return "Payment initialization failed.";
  }

  private async findLineItems(organisationId: string, invoiceId: string) {
    return this.databaseService.db
      .select()
      .from(invoiceLineItems)
      .where(
        and(
          eq(invoiceLineItems.organisationId, organisationId),
          eq(invoiceLineItems.invoiceId, invoiceId)
        )
      )
      .orderBy(asc(invoiceLineItems.sortOrder));
  }

  private async findStatusEvents(organisationId: string, invoiceId: string) {
    return this.databaseService.db
      .select()
      .from(invoiceStatusEvents)
      .where(
        and(
          eq(invoiceStatusEvents.organisationId, organisationId),
          eq(invoiceStatusEvents.invoiceId, invoiceId)
        )
      )
      .orderBy(asc(invoiceStatusEvents.createdAt));
  }

  private async findPaymentsForInvoice(organisationId: string, invoiceId: string) {
    const rows = await this.databaseService.db
      .select({
        payment: payments,
        settlementAccount: organisationPaymentAccounts,
        receipt: receipts
      })
      .from(payments)
      .leftJoin(
        organisationPaymentAccounts,
        and(
          eq(organisationPaymentAccounts.organisationId, payments.organisationId),
          eq(organisationPaymentAccounts.provider, payments.provider),
          eq(organisationPaymentAccounts.providerSubaccountCode, payments.providerSubaccountCode)
        )
      )
      .leftJoin(receipts, eq(receipts.paymentId, payments.id))
      .where(and(eq(payments.organisationId, organisationId), eq(payments.invoiceId, invoiceId)))
      .orderBy(desc(payments.createdAt));
    const paymentIds = rows.map((row) => row.payment.id);
    const events = paymentIds.length
      ? await this.databaseService.db
          .select()
          .from(paymentEvents)
          .where(inArray(paymentEvents.paymentId, paymentIds))
          .orderBy(desc(paymentEvents.createdAt))
      : [];
    const eventsByPaymentId = new Map<string, typeof events>();

    for (const event of events) {
      if (!event.paymentId) {
        continue;
      }

      const current = eventsByPaymentId.get(event.paymentId) ?? [];
      current.push(event);
      eventsByPaymentId.set(event.paymentId, current);
    }

    return rows.map((row) =>
      this.toInvoicePaymentHistoryItem(
        row.payment,
        row.settlementAccount,
        row.receipt,
        eventsByPaymentId.get(row.payment.id) ?? []
      )
    );
  }

  private toInvoicePaymentHistoryItem(
    payment: Payment,
    settlementAccount: OrganisationPaymentAccount | null,
    receipt: Receipt | null,
    events: { errorMessage: string | null }[]
  ) {
    return {
      id: payment.id,
      provider: payment.provider,
      providerReference: payment.providerReference,
      status: payment.status,
      reconciliationState: this.toPaymentReconciliationState(payment, settlementAccount, events),
      currency: payment.currency,
      amountKobo: payment.amountKobo,
      paidAt: payment.paidAt,
      failedAt: payment.failedAt,
      abandonedAt: payment.abandonedAt,
      initializedAt: payment.initializedAt,
      createdAt: payment.createdAt,
      settlementAccount: settlementAccount
        ? {
            provider: settlementAccount.provider,
            bankName: settlementAccount.bankName,
            accountName: settlementAccount.accountName,
            accountNumberLast4: settlementAccount.accountNumberLast4,
            status: settlementAccount.status
          }
        : null,
      receipt: receipt
        ? {
            id: receipt.id,
            receiptNumber: receipt.receiptNumber,
            issuedAt: receipt.issuedAt
          }
        : null
    };
  }

  private toPaymentReconciliationState(
    payment: Payment,
    settlementAccount: OrganisationPaymentAccount | null,
    events: { errorMessage: string | null }[]
  ) {
    if (
      payment.status === "successful" &&
      (!payment.providerSubaccountCode || !settlementAccount)
    ) {
      return "review_required";
    }

    if (payment.status === "pending") {
      return "pending_confirmation";
    }

    if (payment.status === "successful") {
      if (events.some((event) => event.errorMessage)) {
        return "review_required";
      }

      return "matched";
    }

    return payment.status;
  }

  private normalizeInvoiceInput(input: CreateInvoiceDto) {
    this.assertDateOrder(input.issueDate, input.dueDate);

    return {
      customerId: input.customerId,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      customerReference: this.nullableText(input.customerReference),
      notes: this.nullableText(input.notes),
      discountKobo: input.discountKobo ?? 0,
      taxKobo: input.taxKobo ?? 0,
      lineItems: this.normalizeLineItems(input.lineItems)
    };
  }

  private normalizeInvoiceUpdateInput(input: UpdateInvoiceDto, invoice: Invoice) {
    const issueDate = input.issueDate ?? invoice.issueDate;
    const dueDate = input.dueDate ?? invoice.dueDate;
    this.assertDateOrder(issueDate, dueDate);

    return {
      customerId: input.customerId,
      issueDate,
      dueDate,
      customerReference:
        input.customerReference !== undefined
          ? this.nullableText(input.customerReference)
          : invoice.customerReference,
      notes: input.notes !== undefined ? this.nullableText(input.notes) : invoice.notes,
      discountKobo: input.discountKobo ?? invoice.discountKobo,
      taxKobo: input.taxKobo ?? invoice.taxKobo,
      lineItems: input.lineItems ? this.normalizeLineItems(input.lineItems) : undefined
    };
  }

  private normalizeLineItems(lineItems: InvoiceLineItemDto[]) {
    if (!lineItems.length) {
      throw new BadRequestException("At least one line item is required.");
    }

    return lineItems.map((lineItem) => {
      const description = lineItem.description.trim();

      if (!description) {
        throw new BadRequestException("Line item description is required.");
      }

      assertInvoiceQuantity(lineItem.quantity);
      assertKoboAmount(lineItem.unitPriceKobo, "Unit price");

      return {
        description,
        quantity: lineItem.quantity,
        unitPriceKobo: lineItem.unitPriceKobo
      };
    });
  }

  private calculateAndValidateTotals(
    lineItems: InvoiceLineItemDto[],
    input: { discountKobo: number; taxKobo: number }
  ) {
    const totals = calculateInvoiceTotals({
      lineItems,
      discountKobo: input.discountKobo,
      taxKobo: input.taxKobo
    });

    if (totals.discountKobo > totals.subtotalKobo) {
      throw new BadRequestException("Discount cannot exceed subtotal.");
    }

    if (totals.totalKobo < 0) {
      throw new BadRequestException("Invoice total cannot be negative.");
    }

    return totals;
  }

  private assertDateOrder(issueDate: string, dueDate: string) {
    if (new Date(`${dueDate}T00:00:00.000Z`) < new Date(`${issueDate}T00:00:00.000Z`)) {
      throw new BadRequestException("Due date must be on or after issue date.");
    }
  }

  private duplicateDueDate(issueDate: string, sourceIssueDate: string, sourceDueDate: string) {
    const sourceIntervalDays = Math.round(
      (Date.parse(`${sourceDueDate}T00:00:00.000Z`) -
        Date.parse(`${sourceIssueDate}T00:00:00.000Z`)) /
        86_400_000
    );
    const dueDate = new Date(`${issueDate}T00:00:00.000Z`);
    dueDate.setUTCDate(dueDate.getUTCDate() + Math.max(sourceIntervalDays, 0));
    return dueDate.toISOString().slice(0, 10);
  }

  private requiredReason(reason: string) {
    const trimmed = reason.trim();

    if (!trimmed) {
      throw new BadRequestException("A reason is required.");
    }

    return trimmed;
  }

  private nullableText(value?: string | null) {
    if (value === undefined || value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private generatePublicToken() {
    return randomBytes(32).toString("hex");
  }

  private generatePaymentReference(invoiceNumber: string) {
    const suffix = randomBytes(4).toString("hex").toUpperCase();
    return `SME-${invoiceNumber.replace(/[^A-Z0-9]/gi, "")}-${suffix}`;
  }

  private createPublicInvoiceUrl(publicToken: string) {
    const frontendUrl =
      this.configService.get<string>("FRONTEND_APP_URL") ?? "http://localhost:3000";
    return `${frontendUrl.replace(/\/$/, "")}/invoice/${publicToken}`;
  }

  private createPaymentCallbackUrl(publicToken: string, reference: string) {
    return `${this.createPublicInvoiceUrl(publicToken)}?payment=callback&reference=${encodeURIComponent(reference)}`;
  }

  private getPagination(input: PaginationInput) {
    const page = input.page ?? 1;
    const limit = Math.min(input.limit ?? 20, 100);
    return { page, limit, offset: (page - 1) * limit };
  }

  private toPaginationResponse(
    pagination: { page: number; limit: number; offset: number },
    total: number
  ) {
    return {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit))
    };
  }

  private displayStatus(invoice: Invoice): InvoiceStatusValue {
    return displayInvoiceStatus(invoice);
  }

  private toSafeInvoiceListItem(invoice: Invoice, customer: Customer) {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customer: this.toSafeCustomer(customer),
      status: this.displayStatus(invoice),
      currency: invoice.currency,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      subtotalKobo: invoice.subtotalKobo,
      discountKobo: invoice.discountKobo,
      taxKobo: invoice.taxKobo,
      totalKobo: invoice.totalKobo,
      amountPaidKobo: invoice.amountPaidKobo,
      balanceDueKobo: invoice.balanceDueKobo,
      publicAccessEnabled: invoice.publicAccessEnabled,
      sentAt: invoice.sentAt,
      paidAt: invoice.paidAt,
      cancelledAt: invoice.cancelledAt,
      voidedAt: invoice.voidedAt,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt
    };
  }

  private toSafeInvoiceDetail(invoice: Invoice, customer: Customer) {
    return {
      ...this.toSafeInvoiceListItem(invoice, customer),
      publicToken: invoice.publicToken,
      customerReference: invoice.customerReference,
      notes: invoice.notes,
      viewedAt: invoice.viewedAt,
      lastViewedAt: invoice.lastViewedAt,
      viewCount: invoice.viewCount
    };
  }

  private toSafeLineItem(lineItem: InvoiceLineItem) {
    return {
      id: lineItem.id,
      description: lineItem.description,
      quantity: Number(lineItem.quantity),
      unitPriceKobo: lineItem.unitPriceKobo,
      lineTotalKobo: lineItem.lineTotalKobo,
      sortOrder: lineItem.sortOrder,
      createdAt: lineItem.createdAt,
      updatedAt: lineItem.updatedAt
    };
  }

  private toSafeStatusEvent(event: InvoiceStatusEvent) {
    return {
      id: event.id,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      reason: event.reason,
      metadataRedacted: event.metadataRedacted,
      createdAt: event.createdAt
    };
  }

  private toSafeCustomer(customer: Customer) {
    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      billingAddress: customer.billingAddress,
      status: customer.archivedAt ? "archived" : "active",
      archivedAt: customer.archivedAt,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt
    };
  }

  private toPublicInvoiceResponse(
    publicInvoice: PublicInvoiceRow,
    lineItems: InvoiceLineItem[],
    paymentAccount: PaymentAvailabilityAccount | null
  ) {
    const { businessProfile, customer, invoice, organisation } = publicInvoice;

    return {
      invoice: {
        invoiceNumber: invoice.invoiceNumber,
        status: this.displayStatus(invoice),
        currency: invoice.currency,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        customerReference: invoice.customerReference,
        notes: invoice.notes,
        subtotalKobo: invoice.subtotalKobo,
        discountKobo: invoice.discountKobo,
        taxKobo: invoice.taxKobo,
        totalKobo: invoice.totalKobo,
        amountPaidKobo: invoice.amountPaidKobo,
        balanceDueKobo: invoice.balanceDueKobo,
        sentAt: invoice.sentAt,
        viewedAt: invoice.viewedAt,
        paidAt: invoice.paidAt
      },
      business: {
        businessName: businessProfile?.businessName ?? organisation.name,
        email: businessProfile?.email ?? null,
        phone: businessProfile?.phone ?? null,
        address: businessProfile?.address ?? null,
        logoUrl: null
      },
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        billingAddress: customer.billingAddress
      },
      lineItems: lineItems.map((lineItem) => ({
        description: lineItem.description,
        quantity: Number(lineItem.quantity),
        unitPriceKobo: lineItem.unitPriceKobo,
        lineTotalKobo: lineItem.lineTotalKobo,
        sortOrder: lineItem.sortOrder
      })),
      paymentSummary: {
        ...this.toPublicPaymentSummary(invoice, paymentAccount)
      }
    };
  }

  private toPublicPaymentSummary(
    invoice: Invoice,
    paymentAccount: PaymentAvailabilityAccount | null
  ): PaymentSummary {
    const displayStatus = this.displayStatus(invoice);

    if (!invoice.publicAccessEnabled || ["draft", "cancelled", "void"].includes(invoice.status)) {
      return {
        available: false as const,
        reason: "invoice_unavailable",
        message: "This invoice is no longer available for payment."
      };
    }

    if (invoice.status === "paid" || invoice.balanceDueKobo <= 0) {
      return {
        available: false as const,
        reason: "no_outstanding_balance",
        message: "This invoice has no outstanding balance."
      };
    }

    if (!["sent", "viewed", "overdue", "partially_paid"].includes(displayStatus)) {
      return {
        available: false as const,
        reason: "payment_unavailable",
        message: "Online payment is unavailable for this invoice."
      };
    }

    if (!paymentAccount) {
      return {
        available: false as const,
        reason: "payment_setup_incomplete",
        message: "This business has not activated online payments yet."
      };
    }

    if (paymentAccount.status === "verification_delayed") {
      return {
        available: false as const,
        reason: "payment_setup_pending",
        message: "Online payments are not active for this business yet."
      };
    }

    if (paymentAccount.status === "disabled" || paymentAccount.disabledAt) {
      return {
        available: false as const,
        reason: "payment_setup_disabled",
        message: "Online payments are currently disabled for this business."
      };
    }

    if (paymentAccount.status !== "active" || !paymentAccount.providerSubaccountCode) {
      return {
        available: false as const,
        reason: "payment_setup_incomplete",
        message: "This business has not activated online payments yet."
      };
    }

    return {
      available: true as const,
      provider: "paystack" as const,
      amountKobo: invoice.balanceDueKobo,
      currency: "NGN" as const,
      message: "Pay securely online."
    };
  }

  private toAuthenticatedPaymentSummary(
    invoice: Invoice,
    paymentAccount: PaymentAvailabilityAccount | null
  ) {
    const publicSummary = this.toPublicPaymentSummary(invoice, paymentAccount);

    if (!publicSummary.available) {
      if (publicSummary.reason.startsWith("payment_setup_")) {
        return {
          ...publicSummary,
          message:
            "Online payments are not active. Complete Payment Setup to allow customers to pay this invoice online."
        };
      }

      return {
        ...publicSummary,
        message:
          publicSummary.reason === "no_outstanding_balance"
            ? "This invoice has no outstanding balance."
            : "Online payment is unavailable for this invoice."
      };
    }

    return {
      ...publicSummary,
      message: "Paystack checkout is enabled on the public invoice page."
    };
  }
}
