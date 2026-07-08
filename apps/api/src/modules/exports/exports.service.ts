import { Inject, Injectable, UnprocessableEntityException } from "@nestjs/common";
import { and, desc, eq, gte, ilike, isNotNull, isNull, lte, or, type SQL } from "drizzle-orm";

import type { ActiveOrganisationContext } from "../../common/types/request-context";
import { DatabaseService } from "../../database/database.service";
import { customers, invoices, type Customer, type Invoice } from "../../database/schema";
import { AuditLogService } from "../audit-log/audit-log.service";
import { displayInvoiceStatus } from "../invoices/invoice-status";
import { PaymentsService } from "../payments/payments.service";
import { ReceiptsService } from "../receipts/receipts.service";
import { serializeCsv, type CsvColumn } from "./csv-serializer";
import {
  AuditLogExportQueryDto,
  CustomerExportQueryDto,
  InvoiceExportQueryDto,
  PaymentExportQueryDto,
  ReceiptExportQueryDto
} from "./dto/export-query.dto";
import { formatDateOnly, formatKoboDecimal, formatTimestamp } from "./export-format";

const exportRowLimit = 10_000;
const exportTooLargeMessage =
  "This export contains more than 10,000 records. Narrow the filters and try again.";

type CsvExportResult = {
  content: string;
  filename: string;
  rowCount: number;
};

type InvoiceExportRow = {
  customer: Customer;
  invoice: Invoice;
};

type PaymentExportRow = Awaited<ReturnType<PaymentsService["listPaymentsForExport"]>>[number];

@Injectable()
export class ExportsService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService,
    @Inject(PaymentsService) private readonly paymentsService: PaymentsService,
    @Inject(ReceiptsService) private readonly receiptsService: ReceiptsService
  ) {}

  async exportCustomers(
    context: ActiveOrganisationContext,
    query: CustomerExportQueryDto
  ): Promise<CsvExportResult> {
    const rows = await this.findCustomerRows(context.activeOrganisation.id, query);

    return this.createCsvExport({
      context,
      dataset: "customers",
      filters: query,
      rows,
      columns: [
        { header: "customer_name", value: (row) => row.name },
        { header: "email", value: (row) => row.email },
        { header: "phone", value: (row) => row.phone },
        { header: "billing_address", value: (row) => row.billingAddress },
        { header: "status", value: (row) => (row.archivedAt ? "archived" : "active") },
        { header: "created_at", value: (row) => formatTimestamp(row.createdAt) },
        { header: "updated_at", value: (row) => formatTimestamp(row.updatedAt) }
      ]
    });
  }

  async exportInvoices(
    context: ActiveOrganisationContext,
    query: InvoiceExportQueryDto
  ): Promise<CsvExportResult> {
    const rows = (await this.findInvoiceRows(context.activeOrganisation.id, query)).filter((row) =>
      query.status ? displayInvoiceStatus(row.invoice) === query.status : true
    );

    return this.createCsvExport({
      context,
      dataset: "invoices",
      filters: query,
      rows,
      columns: [
        { header: "invoice_number", value: (row) => row.invoice.invoiceNumber },
        { header: "customer_name", value: (row) => row.customer.name },
        { header: "customer_email", value: (row) => row.customer.email },
        { header: "status", value: (row) => displayInvoiceStatus(row.invoice) },
        { header: "currency", value: (row) => row.invoice.currency },
        { header: "issue_date", value: (row) => formatDateOnly(row.invoice.issueDate) },
        { header: "due_date", value: (row) => formatDateOnly(row.invoice.dueDate) },
        { header: "subtotal_ngn", value: (row) => formatKoboDecimal(row.invoice.subtotalKobo) },
        { header: "discount_ngn", value: (row) => formatKoboDecimal(row.invoice.discountKobo) },
        { header: "tax_ngn", value: (row) => formatKoboDecimal(row.invoice.taxKobo) },
        { header: "total_ngn", value: (row) => formatKoboDecimal(row.invoice.totalKobo) },
        {
          header: "amount_paid_ngn",
          value: (row) => formatKoboDecimal(row.invoice.amountPaidKobo)
        },
        {
          header: "balance_due_ngn",
          value: (row) => formatKoboDecimal(row.invoice.balanceDueKobo)
        },
        {
          header: "overpayment_ngn",
          value: (row) =>
            formatKoboDecimal(Math.max(row.invoice.amountPaidKobo - row.invoice.totalKobo, 0))
        },
        { header: "sent_at", value: (row) => formatTimestamp(row.invoice.sentAt) },
        { header: "viewed_at", value: (row) => formatTimestamp(row.invoice.viewedAt) },
        { header: "paid_at", value: (row) => formatTimestamp(row.invoice.paidAt) },
        { header: "cancelled_at", value: (row) => formatTimestamp(row.invoice.cancelledAt) },
        { header: "voided_at", value: (row) => formatTimestamp(row.invoice.voidedAt) },
        { header: "created_at", value: (row) => formatTimestamp(row.invoice.createdAt) }
      ]
    });
  }

  async exportPayments(
    context: ActiveOrganisationContext,
    query: PaymentExportQueryDto
  ): Promise<CsvExportResult> {
    const rows = await this.paymentsService.listPaymentsForExport(context, query);

    return this.createCsvExport({
      context,
      dataset: "payments",
      filters: query,
      rows,
      columns: [
        { header: "provider_reference", value: (row) => row.providerReference },
        { header: "invoice_number", value: (row) => row.invoice?.invoiceNumber },
        { header: "customer_name", value: (row) => row.customer?.name },
        { header: "customer_email", value: (row) => row.customer?.email },
        { header: "currency", value: (row) => row.currency },
        { header: "amount_ngn", value: (row) => formatKoboDecimal(row.amountKobo) },
        { header: "payment_status", value: (row) => row.status },
        { header: "primary_state", value: (row) => row.attemptState },
        { header: "reconciliation_state", value: (row) => row.reconciliationState },
        { header: "review_state", value: (row) => row.reviewState },
        { header: "review_reason", value: (row) => row.reviewReason },
        { header: "paid_at", value: (row) => formatTimestamp(row.paidAt) },
        { header: "failed_at", value: (row) => formatTimestamp(row.failedAt) },
        { header: "abandoned_at", value: (row) => formatTimestamp(row.abandonedAt) },
        { header: "initialized_at", value: (row) => formatTimestamp(row.initializedAt) },
        { header: "settlement_bank_name", value: (row) => row.settlementAccount?.bankName },
        { header: "settlement_account_name", value: (row) => row.settlementAccount?.accountName },
        {
          header: "settlement_account_last4",
          value: (row) => row.settlementAccount?.accountNumberLast4
        },
        {
          header: "settlement_account_context",
          value: (row) => this.formatSettlementContext(row)
        },
        {
          header: "processed_refunded_ngn",
          value: (row) => formatKoboDecimal(row.processedRefundedKobo)
        },
        {
          header: "net_payment_contribution_ngn",
          value: (row) => formatKoboDecimal(row.netContributionKobo)
        }
      ]
    });
  }

  async exportReceipts(
    context: ActiveOrganisationContext,
    query: ReceiptExportQueryDto
  ): Promise<CsvExportResult> {
    const rows = await this.receiptsService.listReceiptsForExport(context, query);

    return this.createCsvExport({
      context,
      dataset: "receipts",
      filters: query,
      rows,
      columns: [
        { header: "receipt_number", value: (row) => row.receiptNumber },
        { header: "invoice_number", value: (row) => row.invoice.invoiceNumber },
        { header: "customer_name", value: (row) => row.customer.name },
        { header: "customer_email", value: (row) => row.customer.email },
        { header: "payment_reference", value: (row) => row.paymentReference },
        { header: "payment_provider", value: (row) => row.paymentProvider },
        { header: "payment_channel", value: (row) => row.paymentChannel },
        { header: "currency", value: (row) => row.currency },
        {
          header: "original_payment_ngn",
          value: (row) => formatKoboDecimal(row.refundSummary.originalAmountKobo)
        },
        {
          header: "processed_refunded_ngn",
          value: (row) => formatKoboDecimal(row.refundSummary.processedRefundedKobo)
        },
        {
          header: "net_retained_ngn",
          value: (row) => formatKoboDecimal(row.refundSummary.netRetainedKobo)
        },
        { header: "refund_state", value: (row) => row.refundSummary.refundState },
        { header: "paid_at", value: (row) => formatTimestamp(row.paidAt) },
        { header: "issued_at", value: (row) => formatTimestamp(row.issuedAt) }
      ]
    });
  }

  async exportAuditLogs(
    context: ActiveOrganisationContext,
    query: AuditLogExportQueryDto
  ): Promise<CsvExportResult> {
    const rows = await this.auditLogService.listAuditLogsForExport(context, query);

    return this.createCsvExport({
      context,
      dataset: "audit-logs",
      filters: query,
      rows,
      columns: [
        { header: "timestamp", value: (row) => formatTimestamp(row.createdAt) },
        { header: "actor", value: (row) => row.actor?.name ?? "System" },
        { header: "actor_email", value: (row) => row.actor?.email },
        { header: "action", value: (row) => row.action },
        { header: "category", value: (row) => row.category },
        { header: "resource_type", value: (row) => row.resource?.type },
        { header: "resource_identifier", value: (row) => row.resource?.label },
        { header: "metadata_summary", value: (row) => row.metadataSummary }
      ]
    });
  }

  private async createCsvExport<TRow>(input: {
    columns: CsvColumn<TRow>[];
    context: ActiveOrganisationContext;
    dataset: string;
    filters: object;
    rows: TRow[];
  }): Promise<CsvExportResult> {
    this.assertWithinRowLimit(input.rows);
    const content = serializeCsv(input.columns, input.rows);
    const generatedAt = new Date().toISOString();

    await this.auditLogService.create({
      organisationId: input.context.activeOrganisation.id,
      actorUserId: input.context.user.id,
      action: "export_generated",
      entityType: "export",
      metadataRedacted: {
        dataset: input.dataset,
        filtersSummary: this.summarizeFilters(input.filters),
        rowCount: input.rows.length,
        generatedAt
      }
    });

    return {
      content,
      filename: `${input.dataset}-${generatedAt.slice(0, 10)}.csv`,
      rowCount: input.rows.length
    };
  }

  private assertWithinRowLimit(rows: unknown[]) {
    if (rows.length > exportRowLimit) {
      throw new UnprocessableEntityException(exportTooLargeMessage);
    }
  }

  private async findCustomerRows(organisationId: string, query: CustomerExportQueryDto) {
    const conditions: SQL[] = [eq(customers.organisationId, organisationId)];
    const status = query.status ?? "active";

    if (status === "active") {
      conditions.push(isNull(customers.archivedAt));
    }

    if (status === "archived") {
      conditions.push(isNotNull(customers.archivedAt));
    }

    const search = query.search?.trim();

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(customers.name, pattern),
          ilike(customers.email, pattern),
          ilike(customers.phone, pattern)
        )!
      );
    }

    return this.databaseService.db
      .select()
      .from(customers)
      .where(and(...conditions))
      .orderBy(desc(customers.createdAt));
  }

  private async findInvoiceRows(
    organisationId: string,
    query: InvoiceExportQueryDto
  ): Promise<InvoiceExportRow[]> {
    const conditions: SQL[] = [eq(invoices.organisationId, organisationId)];

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

    return this.databaseService.db
      .select({ invoice: invoices, customer: customers })
      .from(invoices)
      .innerJoin(customers, eq(customers.id, invoices.customerId))
      .where(and(...conditions))
      .orderBy(desc(invoices.createdAt));
  }

  private formatSettlementContext(row: PaymentExportRow) {
    const context = row.settlementAccountContext;

    if (!context) {
      return "";
    }

    if (context.isCurrentActiveAccount) {
      return "current_active";
    }

    if (context.isHistorical) {
      return `historical_${context.currentStatus}`;
    }

    return context.currentStatus;
  }

  private summarizeFilters(filters: object) {
    return Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== undefined && value !== "")
    );
  }
}
