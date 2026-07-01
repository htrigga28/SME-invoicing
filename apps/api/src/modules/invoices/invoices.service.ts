import { randomBytes } from "crypto";
import {
  BadRequestException,
  BadGatewayException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, asc, count, desc, eq, gte, ilike, isNull, lte, or, sql, type SQL } from "drizzle-orm";

import type { ActiveOrganisationContext } from "../../common/types/request-context";
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
  payments,
  type BusinessProfile,
  type Customer,
  type Invoice,
  type InvoiceLineItem,
  type InvoiceStatusEvent,
  type Payment
} from "../../database/schema";
import { AuditLogService } from "../audit-log/audit-log.service";
import { PaystackService } from "../paystack/paystack.service";
import type { CreateInvoiceDto } from "./dto/create-invoice.dto";
import type { InvoiceLineItemDto } from "./dto/invoice-line-item.dto";
import type { ListInvoicesQueryDto } from "./dto/list-invoices-query.dto";
import type { UpdateInvoiceDto } from "./dto/update-invoice.dto";

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
    Math.round(item.quantity * item.unitPriceKobo)
  );
  const subtotalKobo = lineTotalsKobo.reduce((sum, lineTotal) => sum + lineTotal, 0);
  const discountKobo = input.discountKobo ?? 0;
  const taxKobo = input.taxKobo ?? 0;
  const totalKobo = subtotalKobo - discountKobo + taxKobo;

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

function shouldDisplayAsOverdue(input: {
  balanceDueKobo: number;
  dueDate: string;
  status: InvoiceStatusValue;
}) {
  if (["draft", "paid", "cancelled", "void"].includes(input.status)) {
    return false;
  }

  if (input.balanceDueKobo <= 0) {
    return false;
  }

  const today = new Date();
  const dueDate = new Date(`${input.dueDate}T00:00:00.000Z`);
  const todayStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );

  return dueDate < todayStart;
}

@Injectable()
export class InvoicesService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(PaystackService) private readonly paystackService: PaystackService
  ) {}

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

    const [lineItems, statusEvents] = await Promise.all([
      this.findLineItems(context.activeOrganisation.id, invoiceId),
      this.findStatusEvents(context.activeOrganisation.id, invoiceId)
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
    const nextCustomer = normalized.customerId
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

  async sendInvoice(context: ActiveOrganisationContext, invoiceId: string) {
    const invoiceWithCustomer = await this.requireInvoice(context.activeOrganisation.id, invoiceId);

    if (invoiceWithCustomer.invoice.status !== "draft") {
      throw new UnprocessableEntityException("Only draft invoices can be sent.");
    }

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

    const response = await this.getInvoice(context, invoiceId);
    return {
      ...response,
      publicUrl: this.createPublicInvoiceUrl(invoiceWithCustomer.invoice.publicToken)
    };
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

    if (publicInvoice.invoice.status !== "sent" || displayStatus === "overdue") {
      return { success: true };
    }

    const viewedAt = publicInvoice.invoice.viewedAt ?? new Date();

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

    return { success: true };
  }

  async initializePublicInvoicePayment(publicToken: string) {
    const publicInvoice = await this.requirePublicInvoice(publicToken);
    this.assertInvoicePayable(publicInvoice.invoice, publicInvoice.customer);
    const paymentAccount = await this.requireActivePaymentAccount(
      publicInvoice.invoice.organisationId
    );

    const amountKobo = publicInvoice.invoice.balanceDueKobo;
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

  private normalizeInvoiceInput(input: CreateInvoiceDto) {
    this.assertDateOrder(input.issueDate, input.dueDate);

    return {
      customerId: input.customerId,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
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
    return shouldDisplayAsOverdue({
      balanceDueKobo: invoice.balanceDueKobo,
      dueDate: invoice.dueDate,
      status: invoice.status
    })
      ? "overdue"
      : invoice.status;
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
      notes: invoice.notes,
      viewedAt: invoice.viewedAt
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
