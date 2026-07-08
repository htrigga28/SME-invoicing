import { randomBytes } from "crypto";
import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";

import type { ActiveOrganisationContext } from "../../common/types/request-context";
import type { AppDatabase } from "../../database/database.service";
import { DatabaseService } from "../../database/database.service";
import {
  auditLogs,
  businessProfiles,
  customers,
  invoices,
  organisations,
  paymentRefunds,
  payments,
  receiptNumberSequences,
  receipts,
  type Customer,
  type Invoice,
  type Payment,
  type PaymentRefund,
  type Receipt
} from "../../database/schema";
import type { ListReceiptsQueryDto, ReceiptRefundState } from "./dto/list-receipts-query.dto";

type PaginationInput = {
  limit?: number;
  page?: number;
};

type ReceiptWithRelations = {
  customer: Customer | null;
  invoice: Invoice | null;
  payment: Payment | null;
  receipt: Receipt;
  refunds: PaymentRefund[];
};

type ReceiptRefundSummary = {
  originalAmountKobo: number;
  processedRefundedKobo: number;
  netRetainedKobo: number;
  refundState: Exclude<ReceiptRefundState, "all">;
  hasRefundInProgress: boolean;
};

@Injectable()
export class ReceiptsService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
    @Inject(ConfigService) private readonly configService: ConfigService
  ) {}

  async listReceipts(context: ActiveOrganisationContext, query: ListReceiptsQueryDto) {
    const pagination = this.getPagination(query);
    const rows = await this.findReceiptRows(context.activeOrganisation.id, query);
    const filteredRows = this.applyRefundStateFilter(rows, query.refundState);
    const paginationResponse = this.toPaginationResponse(pagination, filteredRows.length);
    const currentPage = Math.max(1, Math.min(pagination.page, paginationResponse.totalPages));
    const offset = (currentPage - 1) * pagination.limit;
    const pageRows = filteredRows.slice(offset, offset + pagination.limit);

    return {
      receipts: pageRows.map((row) => this.toReceiptListItem(row)),
      pagination: {
        ...paginationResponse,
        page: currentPage
      }
    };
  }

  async listReceiptsForExport(
    context: ActiveOrganisationContext,
    query: Omit<ListReceiptsQueryDto, "limit" | "page">
  ) {
    const rows = await this.findReceiptRows(context.activeOrganisation.id, query);
    return this.applyRefundStateFilter(rows, query.refundState).map((row) =>
      this.toReceiptListItem(row)
    );
  }

  async getReceipt(context: ActiveOrganisationContext, receiptId: string) {
    const [row] = await this.findReceiptRows(context.activeOrganisation.id, { receiptId });

    if (!row) {
      throw new NotFoundException("Receipt was not found.");
    }

    return this.toReceiptDetail(row, { includeInternalIds: true });
  }

  async getPublicReceipt(publicToken: string) {
    const [row] = await this.findPublicReceiptRows(publicToken);

    if (!row || !row.receipt.publicAccessEnabled) {
      throw new NotFoundException("Receipt was not found.");
    }

    return this.toReceiptDetail(row, { includeInternalIds: false });
  }

  async ensureReceiptForSuccessfulPayment(tx: AppDatabase, paymentId: string) {
    const existing = await this.findReceiptByPayment(tx, paymentId);

    if (existing) {
      return { created: false, receipt: existing };
    }

    const [row] = await tx
      .select({
        businessProfile: businessProfiles,
        customer: customers,
        invoice: invoices,
        organisation: organisations,
        payment: payments
      })
      .from(payments)
      .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
      .innerJoin(customers, eq(payments.customerId, customers.id))
      .innerJoin(organisations, eq(payments.organisationId, organisations.id))
      .leftJoin(businessProfiles, eq(businessProfiles.organisationId, payments.organisationId))
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!row) {
      throw new NotFoundException("Payment was not found.");
    }

    if (row.payment.status !== "successful") {
      throw new UnprocessableEntityException(
        "Receipts can only be generated for successful payments."
      );
    }

    const sequenceNumber = await this.nextReceiptSequenceNumber(tx, row.payment.organisationId);
    const receiptNumber = formatReceiptNumber(sequenceNumber);
    const publicToken = this.generatePublicToken();
    const paidAt = row.payment.paidAt ?? row.payment.updatedAt;
    const issuedAt = new Date();
    const businessName =
      row.businessProfile?.businessName?.trim() || row.organisation.name || "Business";

    const [created] = await tx
      .insert(receipts)
      .values({
        organisationId: row.payment.organisationId,
        paymentId: row.payment.id,
        invoiceId: row.invoice.id,
        customerId: row.customer.id,
        receiptNumber,
        publicToken,
        publicAccessEnabled: true,
        currency: row.payment.currency,
        amountKobo: row.payment.amountKobo,
        paymentProvider: row.payment.provider,
        paymentReference: row.payment.providerReference,
        paymentChannel: row.payment.channel,
        paidAt,
        issuedAt,
        businessName,
        businessEmail: row.businessProfile?.email ?? null,
        businessPhone: row.businessProfile?.phone ?? null,
        businessAddress: row.businessProfile?.address ?? null,
        customerName: row.customer.name,
        customerEmail: row.customer.email,
        customerPhone: row.customer.phone,
        customerBillingAddress: row.customer.billingAddress,
        invoiceNumber: row.invoice.invoiceNumber
      })
      .onConflictDoNothing({ target: receipts.paymentId })
      .returning();

    const receipt = created ?? (await this.findReceiptByPayment(tx, paymentId));

    if (!receipt) {
      throw new Error("Receipt generation failed.");
    }

    if (created) {
      await tx.insert(auditLogs).values({
        organisationId: row.payment.organisationId,
        actorUserId: null,
        action: "receipt_generated",
        entityType: "receipt",
        entityId: receipt.id,
        metadataRedacted: {
          receiptId: receipt.id,
          receiptNumber: receipt.receiptNumber,
          paymentId: row.payment.id,
          invoiceId: row.invoice.id,
          invoiceNumber: row.invoice.invoiceNumber,
          provider: row.payment.provider,
          providerReference: row.payment.providerReference,
          amountKobo: row.payment.amountKobo
        }
      });
    }

    return { created: Boolean(created), receipt };
  }

  async backfillReceipts() {
    const successfulPayments = await this.databaseService.db
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.status, "successful"))
      .orderBy(desc(payments.paidAt), desc(payments.createdAt));

    let created = 0;
    let existing = 0;

    for (const payment of successfulPayments) {
      const result = await this.databaseService.db.transaction((tx) =>
        this.ensureReceiptForSuccessfulPayment(tx as AppDatabase, payment.id)
      );

      if (result.created) {
        created += 1;
      } else {
        existing += 1;
      }
    }

    return {
      scanned: successfulPayments.length,
      created,
      existing
    };
  }

  private async findReceiptRows(
    organisationId: string,
    query: ListReceiptsQueryDto & { receiptId?: string }
  ) {
    const conditions: SQL[] = [eq(receipts.organisationId, organisationId)];

    if (query.receiptId) {
      conditions.push(eq(receipts.id, query.receiptId));
    }

    if (query.customerId) {
      conditions.push(eq(receipts.customerId, query.customerId));
    }

    if (query.invoiceId) {
      conditions.push(eq(receipts.invoiceId, query.invoiceId));
    }

    if (query.dateFrom) {
      conditions.push(gte(receipts.issuedAt, new Date(`${query.dateFrom}T00:00:00.000Z`)));
    }

    if (query.dateTo) {
      conditions.push(lte(receipts.issuedAt, new Date(`${query.dateTo}T23:59:59.999Z`)));
    }

    const search = query.search?.trim();

    if (search) {
      const pattern = `%${search}%`;
      const searchCondition = or(
        ilike(receipts.receiptNumber, pattern),
        ilike(receipts.invoiceNumber, pattern),
        ilike(receipts.customerName, pattern),
        ilike(receipts.customerEmail, pattern),
        ilike(receipts.paymentReference, pattern)
      );

      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    const rows = await this.databaseService.db
      .select({
        customer: customers,
        invoice: invoices,
        payment: payments,
        receipt: receipts
      })
      .from(receipts)
      .leftJoin(payments, eq(receipts.paymentId, payments.id))
      .leftJoin(invoices, eq(receipts.invoiceId, invoices.id))
      .leftJoin(customers, eq(receipts.customerId, customers.id))
      .where(and(...conditions))
      .orderBy(desc(receipts.issuedAt), desc(receipts.createdAt));

    return this.attachRefunds(rows);
  }

  private async findPublicReceiptRows(publicToken: string) {
    const rows = await this.databaseService.db
      .select({
        customer: customers,
        invoice: invoices,
        payment: payments,
        receipt: receipts
      })
      .from(receipts)
      .leftJoin(payments, eq(receipts.paymentId, payments.id))
      .leftJoin(invoices, eq(receipts.invoiceId, invoices.id))
      .leftJoin(customers, eq(receipts.customerId, customers.id))
      .where(eq(receipts.publicToken, publicToken))
      .limit(1);

    return this.attachRefunds(rows);
  }

  private async attachRefunds(
    rows: {
      customer: Customer | null;
      invoice: Invoice | null;
      payment: Payment | null;
      receipt: Receipt;
    }[]
  ): Promise<ReceiptWithRelations[]> {
    const paymentIds = rows.map((row) => row.receipt.paymentId);
    const refunds =
      paymentIds.length > 0
        ? await this.databaseService.db
            .select()
            .from(paymentRefunds)
            .where(inArray(paymentRefunds.paymentId, paymentIds))
        : [];
    const refundsByPaymentId = new Map<string, PaymentRefund[]>();

    for (const refund of refunds) {
      const paymentRefundsForPayment = refundsByPaymentId.get(refund.paymentId) ?? [];
      paymentRefundsForPayment.push(refund);
      refundsByPaymentId.set(refund.paymentId, paymentRefundsForPayment);
    }

    return rows.map((row) => ({
      ...row,
      refunds: refundsByPaymentId.get(row.receipt.paymentId) ?? []
    }));
  }

  private applyRefundStateFilter(rows: ReceiptWithRelations[], refundState?: ReceiptRefundState) {
    if (!refundState || refundState === "all") {
      return rows;
    }

    return rows.filter((row) => this.toRefundSummary(row).refundState === refundState);
  }

  private toReceiptListItem(row: ReceiptWithRelations) {
    return {
      id: row.receipt.id,
      receiptNumber: row.receipt.receiptNumber,
      currency: row.receipt.currency,
      amountKobo: row.receipt.amountKobo,
      paymentReference: row.receipt.paymentReference,
      paymentProvider: row.receipt.paymentProvider,
      paymentChannel: row.receipt.paymentChannel,
      paidAt: row.receipt.paidAt,
      issuedAt: row.receipt.issuedAt,
      invoice: row.invoice
        ? {
            id: row.invoice.id,
            invoiceNumber: row.invoice.invoiceNumber,
            status: row.invoice.status,
            totalKobo: row.invoice.totalKobo,
            amountPaidKobo: row.invoice.amountPaidKobo,
            balanceDueKobo: row.invoice.balanceDueKobo
          }
        : {
            id: row.receipt.invoiceId,
            invoiceNumber: row.receipt.invoiceNumber,
            status: null,
            totalKobo: null,
            amountPaidKobo: null,
            balanceDueKobo: null
          },
      customer: row.customer
        ? {
            id: row.customer.id,
            name: row.customer.name,
            email: row.customer.email
          }
        : {
            id: row.receipt.customerId,
            name: row.receipt.customerName,
            email: row.receipt.customerEmail
          },
      refundSummary: this.toRefundSummary(row)
    };
  }

  private toReceiptDetail(row: ReceiptWithRelations, options: { includeInternalIds: boolean }) {
    const publicUrl = this.createPublicReceiptUrl(row.receipt.publicToken);
    const receipt = {
      id: options.includeInternalIds ? row.receipt.id : undefined,
      receiptNumber: row.receipt.receiptNumber,
      publicUrl: options.includeInternalIds ? publicUrl : undefined,
      currency: row.receipt.currency,
      amountKobo: row.receipt.amountKobo,
      paymentProvider: row.receipt.paymentProvider,
      paymentReference: row.receipt.paymentReference,
      paymentChannel: row.receipt.paymentChannel,
      paidAt: row.receipt.paidAt,
      issuedAt: row.receipt.issuedAt,
      business: {
        name: row.receipt.businessName,
        email: row.receipt.businessEmail,
        phone: row.receipt.businessPhone,
        address: row.receipt.businessAddress
      },
      customer: {
        id: options.includeInternalIds ? row.receipt.customerId : undefined,
        name: row.receipt.customerName,
        email: row.receipt.customerEmail,
        phone: row.receipt.customerPhone,
        billingAddress: row.receipt.customerBillingAddress
      },
      invoice: {
        id: options.includeInternalIds ? row.receipt.invoiceId : undefined,
        invoiceNumber: row.receipt.invoiceNumber,
        status: options.includeInternalIds ? (row.invoice?.status ?? null) : undefined,
        totalKobo: options.includeInternalIds ? (row.invoice?.totalKobo ?? null) : undefined,
        amountPaidKobo: options.includeInternalIds
          ? (row.invoice?.amountPaidKobo ?? null)
          : undefined,
        balanceDueKobo: options.includeInternalIds
          ? (row.invoice?.balanceDueKobo ?? null)
          : undefined
      },
      payment: {
        id: options.includeInternalIds ? row.receipt.paymentId : undefined,
        status: options.includeInternalIds ? (row.payment?.status ?? null) : undefined,
        provider: row.receipt.paymentProvider,
        providerReference: row.receipt.paymentReference
      },
      refundSummary: this.toRefundSummary(row),
      refunds: options.includeInternalIds
        ? row.refunds.map((refund) => ({
            id: refund.id,
            amountKobo: refund.amountKobo,
            currency: refund.currency,
            status: refund.status,
            reason: refund.reason,
            createdAt: refund.createdAt,
            processedAt: refund.processedAt
          }))
        : undefined
    };

    return { receipt: stripUndefined(receipt) };
  }

  private toRefundSummary(row: ReceiptWithRelations): ReceiptRefundSummary {
    const processedRefundedKobo = row.refunds
      .filter((refund) => refund.status === "processed")
      .reduce((total, refund) => total + refund.amountKobo, 0);
    const hasRefundInProgress = row.refunds.some((refund) =>
      ["pending", "processing", "needs_attention"].includes(refund.status)
    );
    const netRetainedKobo = Math.max(row.receipt.amountKobo - processedRefundedKobo, 0);
    const refundState =
      processedRefundedKobo <= 0
        ? "none"
        : processedRefundedKobo >= row.receipt.amountKobo
          ? "refunded"
          : "partially_refunded";

    return {
      originalAmountKobo: row.receipt.amountKobo,
      processedRefundedKobo,
      netRetainedKobo,
      refundState,
      hasRefundInProgress
    };
  }

  private async findReceiptByPayment(tx: AppDatabase, paymentId: string) {
    const [receipt] = await tx
      .select()
      .from(receipts)
      .where(eq(receipts.paymentId, paymentId))
      .limit(1);

    return receipt ?? null;
  }

  private async nextReceiptSequenceNumber(tx: AppDatabase, organisationId: string) {
    const result = await tx.execute<{ sequence_number: number }>(sql`
      insert into receipt_number_sequences (organisation_id, next_number, updated_at)
      values (${organisationId}, 2, now())
      on conflict (organisation_id)
      do update set next_number = ${receiptNumberSequences.nextNumber} + 1, updated_at = now()
      returning next_number - 1 as sequence_number
    `);
    const [row] = result.rows;

    if (!row) {
      throw new Error("Receipt number generation failed.");
    }

    return Number(row.sequence_number);
  }

  private getPagination(input: PaginationInput) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    return {
      page,
      limit,
      offset: (page - 1) * limit
    };
  }

  private toPaginationResponse(
    pagination: ReturnType<ReceiptsService["getPagination"]>,
    total: number
  ) {
    return {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.max(Math.ceil(total / pagination.limit), 1)
    };
  }

  private generatePublicToken() {
    return randomBytes(32).toString("hex");
  }

  private createPublicReceiptUrl(publicToken: string) {
    const frontendUrl = (
      this.configService.get<string>("FRONTEND_APP_URL") ?? "http://localhost:3000"
    ).replace(/\/$/, "");

    return `${frontendUrl}/receipt/${publicToken}`;
  }
}

function formatReceiptNumber(sequenceNumber: number) {
  return `RCT-${sequenceNumber.toString().padStart(6, "0")}`;
}

function stripUndefined<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((value) => stripUndefined(value)) as T;
  }

  if (!input || typeof input !== "object") {
    return input;
  }

  return Object.fromEntries(
    Object.entries(input).flatMap(([key, value]) => {
      if (value === undefined) {
        return [];
      }

      return [[key, stripUndefined(value)]];
    })
  ) as T;
}
