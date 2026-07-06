import { createHmac, timingSafeEqual } from "crypto";
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, desc, eq, gte, ilike, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";

import type { ActiveOrganisationContext } from "../../common/types/request-context";
import type { AppDatabase } from "../../database/database.service";
import { DatabaseService } from "../../database/database.service";
import {
  auditLogs,
  customers,
  invoiceStatusEvents,
  invoices,
  organisationPaymentAccounts,
  paymentEvents,
  payments,
  type Customer,
  type Invoice,
  type OrganisationPaymentAccount,
  type Payment,
  type PaymentEvent
} from "../../database/schema";
import type { ListPaymentEventsQueryDto } from "./dto/list-payment-events-query.dto";
import type {
  AttemptState,
  ListPaymentsQueryDto,
  PaymentListView,
  ReconciliationState
} from "./dto/list-payments-query.dto";
import type { PaymentSummaryQueryDto } from "./dto/payment-summary-query.dto";
import { PaystackService, type PaystackVerifyResponse } from "../paystack/paystack.service";

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
  currency?: string | null;
  event: PaymentEvent;
  expectedAmountKobo?: number | null;
  invoice?: Invoice;
  message: string;
  payment?: Payment;
  receivedAmountKobo?: number | null;
};

type PaginationInput = {
  limit?: number;
  page?: number;
};

type PaymentWithRelations = {
  customer: Customer | null;
  events: PaymentEvent[];
  invoice: Invoice | null;
  payment: Payment;
  settlementAccount: OrganisationPaymentAccount | null;
};

type SafeSettlementAccount = {
  accountName: string;
  accountNumberLast4: string;
  bankName: string;
  provider: string;
};

type SettlementAccountContext = {
  currentStatus: OrganisationPaymentAccount["status"];
  isCurrentActiveAccount: boolean;
  isHistorical: boolean;
} | null;

type ReviewDetails = {
  currency: string | null;
  expectedAmountKobo: number | null;
  receivedAmountKobo: number | null;
};

type PaymentClassification = {
  attemptState: AttemptState;
  isSuperseded: boolean;
  reconciliationState: ReconciliationState;
  reviewDetails: ReviewDetails | null;
  reviewReason: string | null;
  supersededReason: string | null;
};

type InvoicePaymentContext = {
  effectiveBalanceKobo: number;
  newestUnresolvedPendingId: string | null;
  successfulPaymentTotalKobo: number;
};

type NormalizedSuccessfulPaystackPayment = {
  amountKobo: number;
  channel: string | null;
  currency: string | null;
  eventId?: string;
  eventType?: string;
  gatewayResponse: string | null;
  paidAt: Date;
  providerStatus: string | null;
  reference: string;
  source: "verification" | "webhook";
};

type ReconciliationResult = {
  invoiceUpdated: boolean;
  status: "successful";
};

const paystackProvider = "paystack";
const supportedChargeSuccessEvent = "charge.success";
const stalePendingThresholdMs = 24 * 60 * 60 * 1000;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(PaystackService) private readonly paystackService: PaystackService
  ) {}

  async listPayments(context: ActiveOrganisationContext, query: ListPaymentsQueryDto) {
    const pagination = this.getPagination(query);
    const rows = await this.findPaymentsWithRelations(context.activeOrganisation.id, query);
    const contextRows = await this.findPaymentsWithRelations(context.activeOrganisation.id, {});
    const classifications = this.computePaymentClassifications(rows, contextRows);
    const view = query.view ?? "reconciliation";
    const filteredByState = query.reconciliationState
      ? rows.filter(
          (row) =>
            classifications.get(row.payment.id)?.reconciliationState === query.reconciliationState
        )
      : rows;
    const filteredRows = this.applyPaymentView(filteredByState, classifications, view);
    const paginationResponse = this.toPaginationResponse(pagination, filteredRows.length);
    const currentPage = Math.max(1, Math.min(pagination.page, paginationResponse.totalPages));
    const offset = (currentPage - 1) * pagination.limit;
    const pageRows = filteredRows.slice(offset, offset + pagination.limit);

    return {
      payments: pageRows.map((row) =>
        this.toPaymentListItem(
          row,
          classifications.get(row.payment.id) ?? this.unknownClassification()
        )
      ),
      pagination: {
        ...paginationResponse,
        page: currentPage
      }
    };
  }

  async getPayment(context: ActiveOrganisationContext, paymentId: string) {
    const [row] = await this.findPaymentsWithRelations(context.activeOrganisation.id, {
      paymentId
    });

    if (!row) {
      throw new NotFoundException("Payment was not found.");
    }

    const contextRows = await this.findPaymentsWithRelations(context.activeOrganisation.id, {});
    const classification =
      this.computePaymentClassifications([row], contextRows).get(row.payment.id) ??
      this.unknownClassification();

    return {
      payment: {
        id: row.payment.id,
        provider: row.payment.provider,
        providerReference: row.payment.providerReference,
        status: row.payment.status,
        attemptState: classification.attemptState,
        reconciliationState: classification.reconciliationState,
        isSuperseded: classification.isSuperseded,
        supersededReason: classification.supersededReason,
        reviewReason: classification.reviewReason,
        reviewDetails: classification.reviewDetails,
        currency: row.payment.currency,
        amountKobo: row.payment.amountKobo,
        paidAt: row.payment.paidAt,
        failedAt: row.payment.failedAt,
        abandonedAt: row.payment.abandonedAt,
        channel: row.payment.channel,
        gatewayResponse: row.payment.gatewayResponse,
        initializedAt: row.payment.initializedAt,
        createdAt: row.payment.createdAt,
        updatedAt: row.payment.updatedAt
      },
      invoice: row.invoice
        ? {
            id: row.invoice.id,
            invoiceNumber: row.invoice.invoiceNumber,
            status: row.invoice.status,
            issueDate: row.invoice.issueDate,
            dueDate: row.invoice.dueDate,
            totalKobo: row.invoice.totalKobo,
            amountPaidKobo: row.invoice.amountPaidKobo,
            balanceDueKobo: row.invoice.balanceDueKobo
          }
        : null,
      customer: row.customer
        ? {
            id: row.customer.id,
            name: row.customer.name,
            email: row.customer.email,
            phone: row.customer.phone
          }
        : null,
      settlementAccount: this.toSafeSettlementAccount(row.settlementAccount),
      settlementAccountContext: this.toSettlementAccountContext(row.settlementAccount),
      events: row.events.map((event) => this.toSafePaymentEvent(event)),
      receiptPlaceholder: "Receipts will be available after T014."
    };
  }

  async getPaymentSummary(context: ActiveOrganisationContext, query: PaymentSummaryQueryDto) {
    const rows = await this.findPaymentsWithRelations(context.activeOrganisation.id, query);
    const contextRows = await this.findPaymentsWithRelations(context.activeOrganisation.id, {});
    const classifications = this.computePaymentClassifications(rows, contextRows);
    const totals = {
      collectedKobo: 0,
      pendingKobo: 0,
      failedKobo: 0,
      abandonedKobo: 0,
      refundedKobo: 0,
      paymentCount: rows.length,
      successfulCount: 0,
      pendingCount: 0,
      stalePendingCount: 0,
      failedCount: 0,
      abandonedCount: 0,
      refundedCount: 0,
      reviewRequiredCount: 0,
      supersededCount: 0
    };
    const breakdown = new Map<Payment["status"], { amountKobo: number; count: number }>();

    for (const row of rows) {
      const classification = classifications.get(row.payment.id) ?? this.unknownClassification();
      const current = breakdown.get(row.payment.status) ?? { amountKobo: 0, count: 0 };
      current.amountKobo += row.payment.amountKobo;
      current.count += 1;
      breakdown.set(row.payment.status, current);

      if (classification.attemptState === "review_required") {
        totals.reviewRequiredCount += 1;
      }

      if (classification.attemptState === "superseded") {
        totals.supersededCount += 1;
      }

      if (classification.attemptState === "successful") {
        totals.collectedKobo += row.payment.amountKobo;
        totals.successfulCount += 1;
      } else if (classification.attemptState === "active_pending") {
        totals.pendingKobo += row.payment.amountKobo;
        totals.pendingCount += 1;
      } else if (classification.attemptState === "stale_pending") {
        totals.stalePendingCount += 1;
      } else if (classification.attemptState === "failed_attempt") {
        totals.failedKobo += row.payment.amountKobo;
        totals.failedCount += 1;
      } else if (classification.attemptState === "abandoned_attempt") {
        totals.abandonedKobo += row.payment.amountKobo;
        totals.abandonedCount += 1;
      } else if (classification.attemptState === "refunded_attempt") {
        totals.refundedKobo += row.payment.amountKobo;
        totals.refundedCount += 1;
      }
    }

    return {
      totals,
      statusBreakdown: Array.from(breakdown.entries()).map(([status, value]) => ({
        status,
        count: value.count,
        amountKobo: value.amountKobo
      })),
      recentPayments: rows
        .slice(0, 5)
        .map((row) =>
          this.toPaymentListItem(
            row,
            classifications.get(row.payment.id) ?? this.unknownClassification()
          )
        )
    };
  }

  async listReviewEvents(context: ActiveOrganisationContext, query: ListPaymentEventsQueryDto) {
    const pagination = this.getPagination(query);
    const conditions: SQL[] = [
      or(
        eq(paymentEvents.organisationId, context.activeOrganisation.id),
        eq(payments.organisationId, context.activeOrganisation.id)
      )!
    ];

    if (query.eventType?.trim()) {
      conditions.push(eq(paymentEvents.eventType, query.eventType.trim()));
    }

    if (query.processed !== undefined) {
      conditions.push(eq(paymentEvents.processed, query.processed));
    }

    const whereClause = and(...conditions);
    const rows = await this.databaseService.db
      .select({
        event: paymentEvents,
        payment: payments,
        invoice: invoices,
        customer: customers
      })
      .from(paymentEvents)
      .leftJoin(payments, eq(payments.id, paymentEvents.paymentId))
      .leftJoin(invoices, eq(invoices.id, payments.invoiceId))
      .leftJoin(customers, eq(customers.id, payments.customerId))
      .where(whereClause)
      .orderBy(desc(paymentEvents.createdAt));
    const reviewRows = rows.filter((row) => {
      if (!row.payment) {
        return this.isReviewEvent(row.event);
      }

      return this.isUnresolvedReviewEvent(row.event, {
        customer: row.customer,
        events: [row.event],
        invoice: row.invoice,
        payment: row.payment,
        settlementAccount: null
      });
    });
    const pageRows = reviewRows.slice(pagination.offset, pagination.offset + pagination.limit);

    return {
      events: pageRows.map((row) => ({
        id: row.event.id,
        provider: row.event.provider,
        providerReference: row.event.providerReference,
        eventType: row.event.eventType,
        processed: row.event.processed,
        processedAt: row.event.processedAt,
        errorMessage: row.event.errorMessage,
        createdAt: row.event.createdAt,
        paymentId: row.payment?.id ?? null,
        invoiceNumber: row.invoice?.invoiceNumber ?? null,
        customerName: row.customer?.name ?? null
      })),
      pagination: this.toPaginationResponse(pagination, reviewRows.length)
    };
  }

  async verifyPublicInvoicePayment(publicToken: string, reference: string) {
    const normalizedReference = reference.trim();

    if (!normalizedReference) {
      throw new BadRequestException("Payment reference is required.");
    }

    const [row] = await this.databaseService.db
      .select({ invoice: invoices, payment: payments })
      .from(invoices)
      .innerJoin(
        payments,
        and(
          eq(payments.invoiceId, invoices.id),
          eq(payments.organisationId, invoices.organisationId),
          eq(payments.provider, paystackProvider),
          eq(payments.providerReference, normalizedReference)
        )
      )
      .where(eq(invoices.publicToken, publicToken))
      .limit(1);

    if (!row) {
      throw new NotFoundException("Payment reference was not found for this invoice.");
    }

    const verification = await this.paystackService.verifyTransaction(normalizedReference);

    if (verification.reference !== normalizedReference) {
      throw new UnprocessableEntityException("Payment verification did not match this invoice.");
    }

    const verifiedStatus = this.toVerificationStatus(verification);

    if (verifiedStatus === "successful") {
      const result = await this.databaseService.db.transaction((tx) =>
        this.reconcileSuccessfulPaystackPayment(tx as AppDatabase, {
          amountKobo: verification.amountKobo,
          channel: verification.channel,
          currency: verification.currency,
          gatewayResponse: verification.gatewayResponse,
          paidAt: this.dateValue(verification.paidAt) ?? new Date(),
          providerStatus: verification.status,
          reference: normalizedReference,
          source: "verification"
        })
      );

      return result;
    }

    if (verifiedStatus === "failed" || verifiedStatus === "abandoned") {
      await this.markPaymentAttemptTerminal(row.payment, verifiedStatus, verification);
    }

    return {
      status: verifiedStatus,
      invoiceUpdated: false
    };
  }

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

  private async findPaymentsWithRelations(
    organisationId: string,
    query: Pick<
      ListPaymentsQueryDto,
      "customerId" | "dateFrom" | "dateTo" | "invoiceId" | "search" | "status"
    > & { paymentId?: string }
  ): Promise<PaymentWithRelations[]> {
    const conditions: SQL[] = [eq(payments.organisationId, organisationId)];

    if (query.paymentId) {
      conditions.push(eq(payments.id, query.paymentId));
    }

    if (query.status && query.status !== "all") {
      conditions.push(eq(payments.status, query.status));
    }

    if (query.customerId) {
      conditions.push(eq(payments.customerId, query.customerId));
    }

    if (query.invoiceId) {
      conditions.push(eq(payments.invoiceId, query.invoiceId));
    }

    if (query.dateFrom) {
      conditions.push(gte(payments.createdAt, this.startOfDay(query.dateFrom)));
    }

    if (query.dateTo) {
      conditions.push(lte(payments.createdAt, this.endOfDay(query.dateTo)));
    }

    const search = query.search?.trim();

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(payments.providerReference, pattern),
          ilike(invoices.invoiceNumber, pattern),
          ilike(customers.name, pattern),
          ilike(customers.email, pattern)
        )!
      );
    }

    const rows = await this.databaseService.db
      .select({
        payment: payments,
        invoice: invoices,
        customer: customers,
        settlementAccount: organisationPaymentAccounts
      })
      .from(payments)
      .leftJoin(
        invoices,
        and(
          eq(invoices.id, payments.invoiceId),
          eq(invoices.organisationId, payments.organisationId)
        )
      )
      .leftJoin(
        customers,
        and(
          eq(customers.id, payments.customerId),
          eq(customers.organisationId, payments.organisationId)
        )
      )
      .leftJoin(
        organisationPaymentAccounts,
        and(
          eq(organisationPaymentAccounts.organisationId, payments.organisationId),
          eq(organisationPaymentAccounts.provider, payments.provider),
          eq(organisationPaymentAccounts.providerSubaccountCode, payments.providerSubaccountCode)
        )
      )
      .where(and(...conditions))
      .orderBy(desc(payments.createdAt));

    const eventsByPaymentId = await this.findEventsForPayments(rows.map((row) => row.payment.id));

    return rows.map((row) => ({
      ...row,
      events: eventsByPaymentId.get(row.payment.id) ?? []
    }));
  }

  private async findEventsForPayments(paymentIds: string[]) {
    const eventsByPaymentId = new Map<string, PaymentEvent[]>();

    if (paymentIds.length === 0) {
      return eventsByPaymentId;
    }

    const events = await this.databaseService.db
      .select()
      .from(paymentEvents)
      .where(inArray(paymentEvents.paymentId, paymentIds))
      .orderBy(desc(paymentEvents.createdAt));

    for (const event of events) {
      if (!event.paymentId) {
        continue;
      }

      const current = eventsByPaymentId.get(event.paymentId) ?? [];
      current.push(event);
      eventsByPaymentId.set(event.paymentId, current);
    }

    return eventsByPaymentId;
  }

  private computePaymentClassifications(
    rows: PaymentWithRelations[],
    contextRows: PaymentWithRelations[] = rows
  ) {
    const invoiceContexts = this.buildInvoicePaymentContexts(contextRows);
    return new Map(
      rows.map((row) => [
        row.payment.id,
        this.computePaymentClassification(row, invoiceContexts.get(row.payment.invoiceId) ?? null)
      ])
    );
  }

  private buildInvoicePaymentContexts(rows: PaymentWithRelations[]) {
    const contexts = new Map<string, InvoicePaymentContext>();
    const rowsByInvoiceId = new Map<string, PaymentWithRelations[]>();

    for (const row of rows) {
      const current = rowsByInvoiceId.get(row.payment.invoiceId) ?? [];
      current.push(row);
      rowsByInvoiceId.set(row.payment.invoiceId, current);
    }

    for (const [invoiceId, invoiceRows] of rowsByInvoiceId.entries()) {
      const invoice = invoiceRows.find((row) => row.invoice)?.invoice;
      const successfulPaymentTotalKobo = invoiceRows
        .filter((row) => row.payment.status === "successful")
        .reduce((total, row) => total + row.payment.amountKobo, 0);
      const effectiveBalanceKobo = Math.max(
        (invoice?.totalKobo ?? 0) - successfulPaymentTotalKobo,
        0
      );
      const newestUnresolvedPendingId =
        this.sortNewestAttempts(invoiceRows.filter((row) => row.payment.status === "pending"))[0]
          ?.payment.id ?? null;

      contexts.set(invoiceId, {
        effectiveBalanceKobo,
        newestUnresolvedPendingId,
        successfulPaymentTotalKobo
      });
    }

    return contexts;
  }

  private computePaymentClassification(
    row: PaymentWithRelations,
    invoiceContext: InvoicePaymentContext | null
  ): PaymentClassification {
    const reviewIssue = this.getUnresolvedReviewIssue(row, invoiceContext);

    if (reviewIssue) {
      return {
        attemptState: "review_required",
        reconciliationState: "review_required",
        isSuperseded: false,
        supersededReason: null,
        reviewDetails: reviewIssue.details,
        reviewReason: reviewIssue.reason
      };
    }

    const supersededReason = this.getSupersededReason(row, invoiceContext);

    if (supersededReason) {
      return {
        attemptState: "superseded",
        reconciliationState: "superseded",
        isSuperseded: true,
        supersededReason,
        reviewDetails: null,
        reviewReason: null
      };
    }

    if (row.payment.status === "successful") {
      return {
        attemptState: "successful",
        reconciliationState: "matched",
        isSuperseded: false,
        supersededReason: null,
        reviewDetails: null,
        reviewReason: null
      };
    }

    if (row.payment.status === "pending") {
      const attemptState = this.isStalePending(row.payment) ? "stale_pending" : "active_pending";

      return {
        attemptState,
        reconciliationState:
          attemptState === "stale_pending" ? "stale_pending" : "pending_confirmation",
        isSuperseded: false,
        supersededReason: null,
        reviewDetails: null,
        reviewReason: null
      };
    }

    if (row.payment.status === "failed") {
      return {
        attemptState: "failed_attempt",
        reconciliationState: "failed",
        isSuperseded: false,
        supersededReason: null,
        reviewDetails: null,
        reviewReason: null
      };
    }

    if (row.payment.status === "abandoned") {
      return {
        attemptState: "abandoned_attempt",
        reconciliationState: "abandoned",
        isSuperseded: false,
        supersededReason: null,
        reviewDetails: null,
        reviewReason: null
      };
    }

    if (row.payment.status === "refunded") {
      return {
        attemptState: "refunded_attempt",
        reconciliationState: "refunded",
        isSuperseded: false,
        supersededReason: null,
        reviewDetails: null,
        reviewReason: null
      };
    }

    return this.unknownClassification();
  }

  private getUnresolvedReviewIssue(
    row: PaymentWithRelations,
    invoiceContext: InvoicePaymentContext | null
  ): { details: ReviewDetails | null; reason: string } | null {
    if (!row.invoice) {
      return {
        details: null,
        reason: "Linked invoice could not be found for this payment attempt."
      };
    }

    if (!row.customer) {
      return {
        details: null,
        reason: "Linked customer could not be found for this payment attempt."
      };
    }

    if (row.invoice.organisationId !== row.payment.organisationId) {
      return { details: null, reason: "Linked invoice does not belong to this organisation." };
    }

    if (row.customer.organisationId !== row.payment.organisationId) {
      return { details: null, reason: "Linked customer does not belong to this organisation." };
    }

    if (!row.payment.providerReference) {
      return { details: null, reason: "Provider reference is missing." };
    }

    if (
      row.payment.status === "successful" &&
      (row.invoice.status === "cancelled" || row.invoice.status === "void")
    ) {
      return {
        details: null,
        reason: "Successful payment is linked to an invoice that no longer accepts payment."
      };
    }

    if (this.paymentShouldHaveSubaccount(row.payment) && !row.payment.providerSubaccountCode) {
      return { details: null, reason: "Settlement subaccount trace is missing." };
    }

    if (row.payment.providerSubaccountCode && !row.settlementAccount) {
      return {
        details: null,
        reason: "Settlement subaccount does not match a stored payout account."
      };
    }

    if (
      row.payment.status === "successful" &&
      invoiceContext &&
      invoiceContext.successfulPaymentTotalKobo > row.invoice.totalKobo
    ) {
      return {
        details: {
          currency: row.payment.currency,
          expectedAmountKobo: row.invoice.totalKobo,
          receivedAmountKobo: invoiceContext.successfulPaymentTotalKobo
        },
        reason: "Successful payments exceed the invoice total."
      };
    }

    const reviewEvent = row.events.find((event) => this.isUnresolvedReviewEvent(event, row));

    if (reviewEvent?.errorMessage) {
      return {
        details: this.getReviewDetails(reviewEvent, row.payment),
        reason: reviewEvent.errorMessage
      };
    }

    return null;
  }

  private getSupersededReason(
    row: PaymentWithRelations,
    invoiceContext: InvoicePaymentContext | null
  ) {
    if (!row.invoice || row.payment.status === "successful" || row.payment.status === "refunded") {
      return null;
    }

    if (
      invoiceContext &&
      row.invoice.totalKobo > 0 &&
      (invoiceContext.successfulPaymentTotalKobo >= row.invoice.totalKobo ||
        row.invoice.amountPaidKobo >= row.invoice.totalKobo ||
        row.invoice.balanceDueKobo <= 0 ||
        row.invoice.status === "paid")
    ) {
      return "Invoice already paid by a successful payment.";
    }

    if (row.payment.status === "pending" && invoiceContext?.newestUnresolvedPendingId) {
      if (row.payment.id !== invoiceContext.newestUnresolvedPendingId) {
        return "A newer payment attempt exists for this invoice.";
      }
    }

    if (row.invoice.status === "cancelled" || row.invoice.status === "void") {
      return "Invoice no longer accepts payment.";
    }

    return null;
  }

  private sortNewestAttempts(rows: PaymentWithRelations[]) {
    return [...rows].sort((left, right) => {
      const initializedDifference =
        right.payment.initializedAt.getTime() - left.payment.initializedAt.getTime();

      if (initializedDifference !== 0) {
        return initializedDifference;
      }

      const createdDifference =
        right.payment.createdAt.getTime() - left.payment.createdAt.getTime();

      if (createdDifference !== 0) {
        return createdDifference;
      }

      return right.payment.id.localeCompare(left.payment.id);
    });
  }

  private paymentShouldHaveSubaccount(payment: Payment) {
    return payment.provider === paystackProvider && payment.status === "successful";
  }

  private isStalePending(payment: Payment) {
    return Date.now() - payment.initializedAt.getTime() > stalePendingThresholdMs;
  }

  private isReviewEvent(event: PaymentEvent) {
    if (!event.processed) {
      return true;
    }

    return this.isReviewErrorMessage(event.errorMessage);
  }

  private isUnresolvedReviewEvent(event: PaymentEvent, row: PaymentWithRelations) {
    const normalized = event.errorMessage?.toLowerCase() ?? "";

    if (normalized.includes("amount did not match")) {
      const receivedAmountKobo = this.eventAmountKobo(event);
      return receivedAmountKobo === null || receivedAmountKobo !== row.payment.amountKobo;
    }

    if (normalized.includes("currency did not match")) {
      const currency = this.eventCurrency(event);
      return currency === null || currency !== row.payment.currency || currency !== "NGN";
    }

    if (!event.processed) {
      return true;
    }

    if (!this.isReviewErrorMessage(event.errorMessage)) {
      return false;
    }

    if (
      ["pending", "failed", "abandoned"].includes(row.payment.status) &&
      row.invoice &&
      (row.invoice.status === "paid" || row.invoice.balanceDueKobo <= 0)
    ) {
      return false;
    }

    return true;
  }

  private isReviewErrorMessage(message: string | null) {
    if (!message) {
      return false;
    }

    const normalized = message.toLowerCase();
    const nonReviewMessages = [
      "unsupported paystack event ignored",
      "duplicate webhook ignored",
      "payment was already successful"
    ];

    if (nonReviewMessages.some((item) => normalized.includes(item))) {
      return false;
    }

    return true;
  }

  private getReviewDetails(event: PaymentEvent, payment: Payment): ReviewDetails | null {
    const normalized = event.errorMessage?.toLowerCase() ?? "";

    if (
      !normalized.includes("amount did not match") &&
      !normalized.includes("currency did not match")
    ) {
      return null;
    }

    return {
      expectedAmountKobo: payment.amountKobo,
      receivedAmountKobo: this.eventAmountKobo(event),
      currency: this.eventCurrency(event) ?? payment.currency
    };
  }

  private eventAmountKobo(event: PaymentEvent) {
    const payload = event.payloadRedacted;

    if (!payload || typeof payload !== "object") {
      return null;
    }

    const data = (payload as { data?: unknown }).data;

    if (!data || typeof data !== "object") {
      return null;
    }

    const amount = (data as { amount?: unknown }).amount;
    const parsed = this.numberValue(amount);

    return parsed !== null && parsed > 0 ? parsed : null;
  }

  private eventCurrency(event: PaymentEvent) {
    const payload = event.payloadRedacted;

    if (!payload || typeof payload !== "object") {
      return null;
    }

    const data = (payload as { data?: unknown }).data;

    if (!data || typeof data !== "object") {
      return null;
    }

    return this.safeString((data as { currency?: unknown }).currency, 3);
  }

  private unknownClassification(): PaymentClassification {
    return {
      attemptState: "unknown",
      reconciliationState: "unknown",
      isSuperseded: false,
      supersededReason: null,
      reviewDetails: null,
      reviewReason: null
    };
  }

  private applyPaymentView(
    rows: PaymentWithRelations[],
    classifications: Map<string, PaymentClassification>,
    view: PaymentListView
  ) {
    if (view === "all_attempts") {
      return rows;
    }

    if (view === "review_required") {
      return rows.filter(
        (row) => classifications.get(row.payment.id)?.attemptState === "review_required"
      );
    }

    return rows.filter((row) => {
      const classification = classifications.get(row.payment.id);

      if (!classification) {
        return false;
      }

      if (
        ["successful", "active_pending", "stale_pending", "review_required"].includes(
          classification.attemptState
        )
      ) {
        return true;
      }

      if (
        classification.attemptState === "failed_attempt" ||
        classification.attemptState === "abandoned_attempt"
      ) {
        return this.isLatestMeaningfulFailedAttempt(row, rows, classifications);
      }

      return false;
    });
  }

  private isLatestMeaningfulFailedAttempt(
    row: PaymentWithRelations,
    rows: PaymentWithRelations[],
    classifications: Map<string, PaymentClassification>
  ) {
    if (!row.invoice || row.invoice.balanceDueKobo <= 0) {
      return false;
    }

    const invoiceAttempts = rows.filter((item) => item.payment.invoiceId === row.payment.invoiceId);

    if (
      invoiceAttempts.some((item) =>
        ["successful", "active_pending", "stale_pending", "review_required"].includes(
          classifications.get(item.payment.id)?.attemptState ?? "unknown"
        )
      )
    ) {
      return false;
    }

    const latestFailedAttempt = invoiceAttempts
      .filter((item) =>
        ["failed_attempt", "abandoned_attempt"].includes(
          classifications.get(item.payment.id)?.attemptState ?? "unknown"
        )
      )
      .sort(
        (left, right) => right.payment.createdAt.getTime() - left.payment.createdAt.getTime()
      )[0];

    return latestFailedAttempt?.payment.id === row.payment.id;
  }

  private toPaymentListItem(row: PaymentWithRelations, classification: PaymentClassification) {
    const latestEvent = row.events[0];

    return {
      id: row.payment.id,
      provider: row.payment.provider,
      providerReference: row.payment.providerReference,
      status: row.payment.status,
      attemptState: classification.attemptState,
      reconciliationState: classification.reconciliationState,
      isSuperseded: classification.isSuperseded,
      supersededReason: classification.supersededReason,
      reviewDetails: classification.reviewDetails,
      reviewReason: classification.reviewReason,
      currency: row.payment.currency,
      amountKobo: row.payment.amountKobo,
      paidAt: row.payment.paidAt,
      failedAt: row.payment.failedAt,
      abandonedAt: row.payment.abandonedAt,
      initializedAt: row.payment.initializedAt,
      createdAt: row.payment.createdAt,
      invoice: row.invoice
        ? {
            id: row.invoice.id,
            invoiceNumber: row.invoice.invoiceNumber,
            status: row.invoice.status,
            totalKobo: row.invoice.totalKobo,
            amountPaidKobo: row.invoice.amountPaidKobo,
            balanceDueKobo: row.invoice.balanceDueKobo
          }
        : null,
      customer: row.customer
        ? {
            id: row.customer.id,
            name: row.customer.name,
            email: row.customer.email
          }
        : null,
      settlementAccount: this.toSafeSettlementAccount(row.settlementAccount),
      settlementAccountContext: this.toSettlementAccountContext(row.settlementAccount),
      latestEventSummary: latestEvent
        ? {
            eventType: latestEvent.eventType,
            processed: latestEvent.processed,
            errorMessage: latestEvent.errorMessage,
            createdAt: latestEvent.createdAt
          }
        : null
    };
  }

  private toSafePaymentEvent(event: PaymentEvent) {
    return {
      id: event.id,
      eventType: event.eventType,
      providerReference: event.providerReference,
      processed: event.processed,
      processedAt: event.processedAt,
      errorMessage: event.errorMessage,
      createdAt: event.createdAt
    };
  }

  private toSafeSettlementAccount(
    account: OrganisationPaymentAccount | null
  ): SafeSettlementAccount | null {
    if (!account) {
      return null;
    }

    return {
      provider: account.provider,
      bankName: account.bankName,
      accountName: account.accountName,
      accountNumberLast4: account.accountNumberLast4
    };
  }

  private toSettlementAccountContext(
    account: OrganisationPaymentAccount | null
  ): SettlementAccountContext {
    if (!account) {
      return null;
    }

    const isCurrentActiveAccount = account.status === "active" && !account.disabledAt;

    return {
      currentStatus: account.status,
      isCurrentActiveAccount,
      isHistorical: !isCurrentActiveAccount
    };
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
    pagination: ReturnType<PaymentsService["getPagination"]>,
    total: number
  ) {
    return {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.max(Math.ceil(total / pagination.limit), 1)
    };
  }

  private toVerificationStatus(verification: PaystackVerifyResponse) {
    const normalized = verification.status.toLowerCase();

    if (normalized === "success" || normalized === "successful") {
      return "successful" as const;
    }

    if (normalized === "failed" || normalized === "failure") {
      return "failed" as const;
    }

    if (normalized === "abandoned") {
      return "abandoned" as const;
    }

    return "pending" as const;
  }

  private async markPaymentAttemptTerminal(
    payment: Payment,
    status: "abandoned" | "failed",
    verification: PaystackVerifyResponse
  ) {
    if (payment.status === "successful") {
      return;
    }

    const now = new Date();
    await this.databaseService.db
      .update(payments)
      .set({
        status,
        failedAt: status === "failed" ? (payment.failedAt ?? now) : payment.failedAt,
        abandonedAt: status === "abandoned" ? (payment.abandonedAt ?? now) : payment.abandonedAt,
        channel: verification.channel ?? payment.channel,
        gatewayResponse: verification.gatewayResponse ?? payment.gatewayResponse,
        updatedAt: now
      })
      .where(eq(payments.id, payment.id));
  }

  private logWebhookResult(
    input: NormalizedSuccessfulPaystackPayment | NormalizedWebhook,
    result: {
      matchedPayment: boolean;
      result: "duplicate" | "ignored" | "processed" | "review_required";
    }
  ) {
    if ("source" in input && input.source !== "webhook") {
      return;
    }

    const eventType = input.eventType ?? supportedChargeSuccessEvent;
    const providerReference =
      "providerReference" in input ? input.providerReference : input.reference;

    this.logger.log({
      provider: paystackProvider,
      eventType,
      providerReference,
      signatureValid: true,
      matchedPayment: result.matchedPayment,
      result: result.result
    });
  }

  private startOfDay(value: string) {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private endOfDay(value: string) {
    return new Date(`${value.slice(0, 10)}T23:59:59.999Z`);
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
      this.logWebhookResult(webhook, {
        matchedPayment: true,
        result: "duplicate"
      });
      return;
    }

    if (webhook.eventType !== supportedChargeSuccessEvent) {
      await this.markEventProcessed(tx, event.id, {
        errorMessage: "Unsupported Paystack event ignored."
      });
      this.logWebhookResult(webhook, {
        matchedPayment: false,
        result: "ignored"
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
      this.logWebhookResult(webhook, {
        matchedPayment: false,
        result: "review_required"
      });
      return;
    }

    await this.reconcileSuccessfulPaystackPayment(tx, {
      amountKobo: this.numberValue(webhook.payload.data?.amount) ?? 0,
      channel: this.safeString(webhook.payload.data?.channel, 80),
      currency: this.safeString(webhook.payload.data?.currency, 3),
      eventId: event.id,
      eventType: webhook.eventType,
      gatewayResponse: this.safeString(webhook.payload.data?.gateway_response, 500),
      paidAt: this.dateValue(webhook.payload.data?.paid_at) ?? new Date(),
      providerStatus: this.safeString(webhook.payload.data?.status, 80),
      reference: webhook.providerReference,
      source: "webhook"
    });
  }

  private async reconcileSuccessfulPaystackPayment(
    tx: AppDatabase,
    input: NormalizedSuccessfulPaystackPayment
  ): Promise<ReconciliationResult> {
    const event = input.eventId ? await this.findPaymentEvent(tx, input.eventId) : null;
    const payment = await this.findPaymentByReference(tx, input.reference);

    if (!payment) {
      if (event) {
        await this.markEventProcessed(tx, event.id, {
          errorMessage: "Unknown payment reference."
        });
      }
      await this.createAuditLog(tx, {
        organisationId: null,
        action:
          input.source === "webhook"
            ? "payment_webhook_unknown_reference"
            : "payment_verification_unknown_reference",
        entityType: "payment_event",
        entityId: event?.id ?? null,
        metadataRedacted: {
          providerReference: input.reference,
          eventType: input.eventType,
          source: input.source
        }
      });
      this.logWebhookResult(input, {
        matchedPayment: false,
        result: "review_required"
      });
      return { invoiceUpdated: false, status: "successful" };
    }

    const invoice = await this.findInvoice(tx, payment.invoiceId);

    if (!invoice) {
      if (event) {
        await this.markMismatch(tx, {
          event,
          payment,
          message: "Payment invoice was not found."
        });
      }
      this.logWebhookResult(input, {
        matchedPayment: true,
        result: "review_required"
      });
      return { invoiceUpdated: false, status: "successful" };
    }

    if (event) {
      await this.linkEventToPayment(tx, event.id, payment);
    }

    if (input.amountKobo !== payment.amountKobo) {
      if (event) {
        await this.markMismatch(tx, {
          event,
          payment,
          invoice,
          message: "Payment amount did not match the pending payment.",
          expectedAmountKobo: payment.amountKobo,
          receivedAmountKobo: input.amountKobo,
          currency: input.currency
        });
      } else {
        await this.createAuditLog(tx, {
          organisationId: payment.organisationId,
          action: "payment_verification_mismatch",
          entityType: "payment",
          entityId: payment.id,
          metadataRedacted: {
            providerReference: payment.providerReference,
            expectedAmountKobo: payment.amountKobo,
            receivedAmountKobo: input.amountKobo,
            currency: input.currency
          }
        });
      }
      this.logWebhookResult(input, {
        matchedPayment: true,
        result: "review_required"
      });
      if (event) {
        return { invoiceUpdated: false, status: "successful" };
      }
      throw new UnprocessableEntityException(
        "Payment verification did not match the initialized payment."
      );
    }

    if (input.currency !== "NGN" || payment.currency !== "NGN") {
      if (event) {
        await this.markMismatch(tx, {
          event,
          payment,
          invoice,
          message: "Payment currency did not match NGN.",
          expectedAmountKobo: payment.amountKobo,
          receivedAmountKobo: input.amountKobo,
          currency: input.currency
        });
      } else {
        await this.createAuditLog(tx, {
          organisationId: payment.organisationId,
          action: "payment_verification_mismatch",
          entityType: "payment",
          entityId: payment.id,
          metadataRedacted: {
            providerReference: payment.providerReference,
            expectedCurrency: payment.currency,
            receivedCurrency: input.currency
          }
        });
      }
      this.logWebhookResult(input, {
        matchedPayment: true,
        result: "review_required"
      });
      if (event) {
        return { invoiceUpdated: false, status: "successful" };
      }
      throw new UnprocessableEntityException(
        "Payment verification did not match the initialized payment."
      );
    }

    if (payment.status === "successful") {
      if (event) {
        await this.markEventProcessed(tx, event.id, {
          errorMessage: "Payment was already successful."
        });
      }
      await this.createAuditLog(tx, {
        organisationId: payment.organisationId,
        action:
          input.source === "webhook"
            ? "payment_webhook_duplicate_ignored"
            : "payment_verification_duplicate_ignored",
        entityType: "payment",
        entityId: payment.id,
        metadataRedacted: {
          eventId: event?.id,
          providerReference: payment.providerReference
        }
      });
      this.logWebhookResult(input, {
        matchedPayment: true,
        result: "duplicate"
      });
      return { invoiceUpdated: false, status: "successful" };
    }

    await this.markPaymentSuccessful(tx, payment, input);

    if (["cancelled", "void"].includes(invoice.status)) {
      if (event) {
        await this.markEventProcessed(tx, event.id);
      }
      await this.createAuditLog(tx, {
        organisationId: payment.organisationId,
        action: "payment_for_cancelled_or_void_invoice",
        entityType: "payment",
        entityId: payment.id,
        metadataRedacted: {
          eventId: event?.id,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          invoiceStatus: invoice.status,
          providerReference: payment.providerReference,
          source: input.source
        }
      });
      this.logWebhookResult(input, {
        matchedPayment: true,
        result: "review_required"
      });
      return { invoiceUpdated: false, status: "successful" };
    }

    await this.reconcileInvoice(tx, invoice, payment, event?.id ?? null, input.paidAt);

    if (event) {
      await this.markEventProcessed(tx, event.id);
    }

    this.logWebhookResult(input, {
      matchedPayment: true,
      result: "processed"
    });

    return { invoiceUpdated: true, status: "successful" };
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

  private async findPaymentEvent(tx: AppDatabase, eventId: string) {
    const [event] = await tx
      .select()
      .from(paymentEvents)
      .where(eq(paymentEvents.id, eventId))
      .limit(1);

    return event ?? null;
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
    input: NormalizedSuccessfulPaystackPayment
  ) {
    const metadata = {
      ...(typeof payment.metadataRedacted === "object" && payment.metadataRedacted
        ? payment.metadataRedacted
        : {}),
      confirmationSource: input.source,
      webhookEvent: input.eventType,
      providerStatus: input.providerStatus
    };

    await tx
      .update(payments)
      .set({
        status: "successful",
        paidAt: input.paidAt,
        channel: input.channel,
        gatewayResponse: input.gatewayResponse,
        metadataRedacted: metadata,
        updatedAt: new Date()
      })
      .where(eq(payments.id, payment.id));
  }

  private async reconcileInvoice(
    tx: AppDatabase,
    invoice: Invoice,
    payment: Payment,
    eventId: string | null,
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
        message: input.message,
        expectedAmountKobo: input.expectedAmountKobo,
        receivedAmountKobo: input.receivedAmountKobo,
        currency: input.currency
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
