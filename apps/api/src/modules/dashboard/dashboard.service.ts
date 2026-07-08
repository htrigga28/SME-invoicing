import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gte, inArray, lt, sql, type SQL } from "drizzle-orm";

import type { ActiveOrganisationContext } from "../../common/types/request-context";
import { DatabaseService } from "../../database/database.service";
import {
  customers,
  invoices,
  organisationPaymentAccounts,
  paymentRefunds,
  payments,
  receipts,
  type Invoice
} from "../../database/schema";
import { displayInvoiceStatus } from "../invoices/invoice-status";
import { PaymentsService } from "../payments/payments.service";
import type {
  DashboardOverviewQueryDto,
  DashboardResolvedGranularity
} from "./dto/dashboard-overview-query.dto";

type InvoiceStatusValue = Invoice["status"];

type DashboardPeriod = {
  dateFrom: string;
  dateTo: string;
  granularity: DashboardResolvedGranularity;
  timezone: typeof dashboardTimezone;
  utcEndExclusive: Date;
  utcStart: Date;
};

type FinancialActivity = {
  grossCollectedKobo: number;
  netCollectedKobo: number;
  processedRefundCount: number;
  processedRefundsKobo: number;
  receiptsIssuedCount: number;
  successfulPaymentCount: number;
};

type InvoiceDashboardRow = {
  customer: {
    email: string;
    id: string;
    name: string;
  };
  invoice: Invoice;
};

type PaymentRefundRow = {
  amountKobo: number;
  paymentId: string;
  status: "failed" | "needs_attention" | "pending" | "processed" | "processing";
};

const dashboardTimezone = "Africa/Lagos";
const lagosUtcOffsetMs = 60 * 60 * 1000;
const dayMs = 24 * 60 * 60 * 1000;
const maxDashboardRangeDays = 731;
const activeBalanceStatusSql = sql`${invoices.status} not in ('draft', 'cancelled', 'void', 'paid')`;
const invoiceStatusValues: InvoiceStatusValue[] = [
  "draft",
  "sent",
  "viewed",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
  "void"
];

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
    @Inject(PaymentsService) private readonly paymentsService: PaymentsService
  ) {}

  async getOverview(context: ActiveOrganisationContext, query: DashboardOverviewQueryDto) {
    const period = this.resolvePeriod(query);
    const organisationId = context.activeOrganisation.id;

    const [
      financialActivity,
      cashflowTrend,
      operational,
      recentInvoiceRows,
      paymentSummary,
      recentPaymentsResponse,
      reviewPaymentsResponse,
      recentReceipts,
      paymentSetup
    ] = await Promise.all([
      this.getFinancialActivity(organisationId, period),
      this.getCashflowTrend(organisationId, period),
      this.getOperationalInvoiceMetrics(organisationId),
      this.findRecentInvoiceRows(organisationId),
      this.paymentsService.getPaymentSummary(context, {}),
      this.paymentsService.listPayments(context, {
        limit: 5,
        page: 1,
        view: "reconciliation"
      }),
      this.paymentsService.listPayments(context, {
        limit: 5,
        page: 1,
        view: "review_required"
      }),
      this.findRecentReceipts(organisationId),
      this.findPaymentSetup(organisationId)
    ]);

    return {
      period: {
        dateFrom: period.dateFrom,
        dateTo: period.dateTo,
        granularity: period.granularity,
        timezone: period.timezone
      },
      financialActivity,
      currentPosition: {
        outstandingKobo: operational.outstandingKobo,
        overdueKobo: operational.overdueKobo,
        outstandingInvoiceCount: operational.outstandingInvoiceCount,
        overdueInvoiceCount: operational.overdueInvoiceCount,
        activePendingPaymentCount:
          paymentSummary.totals.pendingCount + paymentSummary.totals.stalePendingCount,
        unresolvedReviewCount: paymentSummary.totals.reviewRequiredCount
      },
      invoiceStatusBreakdown: operational.invoiceStatusBreakdown,
      outstandingAging: operational.outstandingAging,
      cashflowTrend,
      recentInvoices: this.toRecentInvoices(recentInvoiceRows),
      recentPayments: recentPaymentsResponse.payments.map((payment) => ({
        id: payment.id,
        providerReference: payment.providerReference,
        amountKobo: payment.amountKobo,
        currency: payment.currency,
        state: payment.attemptState,
        status: payment.status,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
        invoice: payment.invoice
          ? {
              id: payment.invoice.id,
              invoiceNumber: payment.invoice.invoiceNumber
            }
          : null,
        customer: payment.customer
          ? {
              id: payment.customer.id,
              name: payment.customer.name
            }
          : null
      })),
      recentReceipts,
      reviewIssues: reviewPaymentsResponse.payments.map((payment) => ({
        id: payment.id,
        type: "payment" as const,
        summary: payment.reviewReason ?? "Payment requires reconciliation review.",
        state: payment.reconciliationState,
        reviewState: payment.reviewState,
        amountKobo: payment.amountKobo,
        createdAt: payment.createdAt,
        paymentId: payment.id,
        invoice: payment.invoice
          ? {
              id: payment.invoice.id,
              invoiceNumber: payment.invoice.invoiceNumber
            }
          : null,
        customer: payment.customer
          ? {
              id: payment.customer.id,
              name: payment.customer.name
            }
          : null
      })),
      paymentSetup
    };
  }

  private async getFinancialActivity(
    organisationId: string,
    period: DashboardPeriod
  ): Promise<FinancialActivity> {
    const [paymentsAggregate, refundsAggregate, receiptsAggregate] = await Promise.all([
      this.databaseService.db
        .select({
          grossCollectedKobo: sql<number>`coalesce(sum(${payments.amountKobo}), 0)`.mapWith(Number),
          successfulPaymentCount: sql<number>`count(*)::int`.mapWith(Number)
        })
        .from(payments)
        .where(
          and(
            eq(payments.organisationId, organisationId),
            eq(payments.status, "successful"),
            gte(payments.paidAt, period.utcStart),
            lt(payments.paidAt, period.utcEndExclusive)
          )
        ),
      this.databaseService.db
        .select({
          processedRefundsKobo: sql<number>`coalesce(sum(${paymentRefunds.amountKobo}), 0)`.mapWith(
            Number
          ),
          processedRefundCount: sql<number>`count(*)::int`.mapWith(Number)
        })
        .from(paymentRefunds)
        .where(
          and(
            eq(paymentRefunds.organisationId, organisationId),
            eq(paymentRefunds.status, "processed"),
            gte(paymentRefunds.processedAt, period.utcStart),
            lt(paymentRefunds.processedAt, period.utcEndExclusive)
          )
        ),
      this.databaseService.db
        .select({
          receiptsIssuedCount: sql<number>`count(*)::int`.mapWith(Number)
        })
        .from(receipts)
        .where(
          and(
            eq(receipts.organisationId, organisationId),
            gte(receipts.issuedAt, period.utcStart),
            lt(receipts.issuedAt, period.utcEndExclusive)
          )
        )
    ]);

    const paymentTotals = paymentsAggregate[0] ?? {
      grossCollectedKobo: 0,
      successfulPaymentCount: 0
    };
    const refundTotals = refundsAggregate[0] ?? {
      processedRefundCount: 0,
      processedRefundsKobo: 0
    };
    const receiptTotals = receiptsAggregate[0] ?? { receiptsIssuedCount: 0 };
    const grossCollectedKobo = paymentTotals.grossCollectedKobo;
    const processedRefundsKobo = refundTotals.processedRefundsKobo;

    return {
      grossCollectedKobo,
      processedRefundsKobo,
      netCollectedKobo: grossCollectedKobo - processedRefundsKobo,
      successfulPaymentCount: paymentTotals.successfulPaymentCount,
      processedRefundCount: refundTotals.processedRefundCount,
      receiptsIssuedCount: receiptTotals.receiptsIssuedCount
    };
  }

  private async getCashflowTrend(organisationId: string, period: DashboardPeriod) {
    const buckets = this.createTrendBuckets(period.dateFrom, period.dateTo, period.granularity);
    const trend = new Map(
      buckets.map((bucket) => [
        bucket,
        {
          period: bucket,
          grossCollectedKobo: 0,
          processedRefundsKobo: 0,
          netCollectedKobo: 0
        }
      ])
    );
    const paymentBucket = this.bucketSql(payments.paidAt, period.granularity);
    const refundBucket = this.bucketSql(paymentRefunds.processedAt, period.granularity);
    const [paymentRows, refundRows] = await Promise.all([
      this.databaseService.db
        .select({
          period: paymentBucket,
          grossCollectedKobo: sql<number>`coalesce(sum(${payments.amountKobo}), 0)`.mapWith(Number)
        })
        .from(payments)
        .where(
          and(
            eq(payments.organisationId, organisationId),
            eq(payments.status, "successful"),
            gte(payments.paidAt, period.utcStart),
            lt(payments.paidAt, period.utcEndExclusive)
          )
        )
        .groupBy(sql`1`),
      this.databaseService.db
        .select({
          period: refundBucket,
          processedRefundsKobo: sql<number>`coalesce(sum(${paymentRefunds.amountKobo}), 0)`.mapWith(
            Number
          )
        })
        .from(paymentRefunds)
        .where(
          and(
            eq(paymentRefunds.organisationId, organisationId),
            eq(paymentRefunds.status, "processed"),
            gte(paymentRefunds.processedAt, period.utcStart),
            lt(paymentRefunds.processedAt, period.utcEndExclusive)
          )
        )
        .groupBy(sql`1`)
    ]);

    for (const row of paymentRows) {
      const current = trend.get(row.period);

      if (current) {
        current.grossCollectedKobo = row.grossCollectedKobo;
      }
    }

    for (const row of refundRows) {
      const current = trend.get(row.period);

      if (current) {
        current.processedRefundsKobo = row.processedRefundsKobo;
      }
    }

    return Array.from(trend.values()).map((item) => ({
      ...item,
      netCollectedKobo: item.grossCollectedKobo - item.processedRefundsKobo
    }));
  }

  private async getOperationalInvoiceMetrics(organisationId: string) {
    const statusToday = this.utcDateString(new Date());
    const lagosToday = this.lagosDateString(new Date());
    const outstandingCondition = sql`${invoices.balanceDueKobo} > 0 and ${activeBalanceStatusSql}`;
    const overdueCondition = sql`${outstandingCondition} and ${invoices.dueDate} < ${statusToday}`;
    const effectiveStatus = sql<InvoiceStatusValue>`case
      when ${overdueCondition} then 'overdue'
      else ${invoices.status}
    end`;
    const [currentRows, statusRows, agingRows] = await Promise.all([
      this.databaseService.db
        .select({
          outstandingKobo:
            sql<number>`coalesce(sum(case when ${outstandingCondition} then greatest(${invoices.balanceDueKobo}, 0) else 0 end), 0)`.mapWith(
              Number
            ),
          overdueKobo:
            sql<number>`coalesce(sum(case when ${overdueCondition} then greatest(${invoices.balanceDueKobo}, 0) else 0 end), 0)`.mapWith(
              Number
            ),
          outstandingInvoiceCount:
            sql<number>`count(*) filter (where ${outstandingCondition})::int`.mapWith(Number),
          overdueInvoiceCount:
            sql<number>`count(*) filter (where ${overdueCondition})::int`.mapWith(Number)
        })
        .from(invoices)
        .where(eq(invoices.organisationId, organisationId)),
      this.databaseService.db
        .select({
          status: effectiveStatus,
          count: sql<number>`count(*)::int`.mapWith(Number),
          balanceKobo:
            sql<number>`coalesce(sum(case when ${outstandingCondition} then greatest(${invoices.balanceDueKobo}, 0) else 0 end), 0)`.mapWith(
              Number
            )
        })
        .from(invoices)
        .where(eq(invoices.organisationId, organisationId))
        .groupBy(sql`1`),
      this.databaseService.db
        .select({
          notDueKobo:
            sql<number>`coalesce(sum(case when ${outstandingCondition} and ${invoices.dueDate} >= ${lagosToday} then greatest(${invoices.balanceDueKobo}, 0) else 0 end), 0)`.mapWith(
              Number
            ),
          overdue1To7DaysKobo:
            sql<number>`coalesce(sum(case when ${outstandingCondition} and ${invoices.dueDate} < ${lagosToday} and (${lagosToday}::date - ${invoices.dueDate}) between 1 and 7 then greatest(${invoices.balanceDueKobo}, 0) else 0 end), 0)`.mapWith(
              Number
            ),
          overdue8To30DaysKobo:
            sql<number>`coalesce(sum(case when ${outstandingCondition} and ${invoices.dueDate} < ${lagosToday} and (${lagosToday}::date - ${invoices.dueDate}) between 8 and 30 then greatest(${invoices.balanceDueKobo}, 0) else 0 end), 0)`.mapWith(
              Number
            ),
          overdue31PlusDaysKobo:
            sql<number>`coalesce(sum(case when ${outstandingCondition} and ${invoices.dueDate} < ${lagosToday} and (${lagosToday}::date - ${invoices.dueDate}) > 30 then greatest(${invoices.balanceDueKobo}, 0) else 0 end), 0)`.mapWith(
              Number
            )
        })
        .from(invoices)
        .where(eq(invoices.organisationId, organisationId))
    ]);
    const statusBreakdown = new Map(
      invoiceStatusValues.map((status) => [
        status,
        {
          status,
          count: 0,
          balanceKobo: 0
        }
      ])
    );

    for (const row of statusRows) {
      const current = statusBreakdown.get(row.status);

      if (current) {
        current.count = row.count;
        current.balanceKobo = row.balanceKobo;
      }
    }

    const current = currentRows[0] ?? {
      outstandingKobo: 0,
      overdueKobo: 0,
      outstandingInvoiceCount: 0,
      overdueInvoiceCount: 0
    };
    const outstandingAging = agingRows[0] ?? {
      notDueKobo: 0,
      overdue1To7DaysKobo: 0,
      overdue8To30DaysKobo: 0,
      overdue31PlusDaysKobo: 0
    };

    return {
      ...current,
      invoiceStatusBreakdown: invoiceStatusValues.map(
        (status) => statusBreakdown.get(status) ?? { status, count: 0, balanceKobo: 0 }
      ),
      outstandingAging
    };
  }

  private async findRecentInvoiceRows(organisationId: string): Promise<InvoiceDashboardRow[]> {
    return this.databaseService.db
      .select({
        invoice: invoices,
        customer: {
          id: customers.id,
          name: customers.name,
          email: customers.email
        }
      })
      .from(invoices)
      .innerJoin(
        customers,
        and(
          eq(customers.id, invoices.customerId),
          eq(customers.organisationId, invoices.organisationId)
        )
      )
      .where(eq(invoices.organisationId, organisationId))
      .orderBy(desc(invoices.createdAt))
      .limit(5);
  }

  private toRecentInvoices(rows: InvoiceDashboardRow[]) {
    return rows.slice(0, 5).map((row) => ({
      id: row.invoice.id,
      invoiceNumber: row.invoice.invoiceNumber,
      status: displayInvoiceStatus(row.invoice),
      currency: row.invoice.currency,
      totalKobo: row.invoice.totalKobo,
      balanceDueKobo: row.invoice.balanceDueKobo,
      dueDate: row.invoice.dueDate,
      createdAt: row.invoice.createdAt,
      customer: {
        id: row.customer.id,
        name: row.customer.name
      }
    }));
  }

  private async findRecentReceipts(organisationId: string) {
    const rows = await this.databaseService.db
      .select({
        id: receipts.id,
        receiptNumber: receipts.receiptNumber,
        paymentId: receipts.paymentId,
        invoiceId: receipts.invoiceId,
        invoiceNumber: receipts.invoiceNumber,
        customerId: receipts.customerId,
        customerName: receipts.customerName,
        amountKobo: receipts.amountKobo,
        currency: receipts.currency,
        issuedAt: receipts.issuedAt
      })
      .from(receipts)
      .where(eq(receipts.organisationId, organisationId))
      .orderBy(desc(receipts.issuedAt), desc(receipts.createdAt))
      .limit(5);
    const refundsByPaymentId = await this.findRefundsByPaymentId(rows.map((row) => row.paymentId));

    return rows.map((row) => ({
      id: row.id,
      receiptNumber: row.receiptNumber,
      amountKobo: row.amountKobo,
      currency: row.currency,
      issuedAt: row.issuedAt,
      invoice: {
        id: row.invoiceId,
        invoiceNumber: row.invoiceNumber
      },
      customer: {
        id: row.customerId,
        name: row.customerName
      },
      refundSummary: this.toReceiptRefundSummary(
        row.amountKobo,
        refundsByPaymentId.get(row.paymentId) ?? []
      )
    }));
  }

  private async findRefundsByPaymentId(paymentIds: string[]) {
    const refundsByPaymentId = new Map<string, PaymentRefundRow[]>();

    if (!paymentIds.length) {
      return refundsByPaymentId;
    }

    const refunds = await this.databaseService.db
      .select({
        paymentId: paymentRefunds.paymentId,
        amountKobo: paymentRefunds.amountKobo,
        status: paymentRefunds.status
      })
      .from(paymentRefunds)
      .where(inArray(paymentRefunds.paymentId, paymentIds));

    for (const refund of refunds) {
      const current = refundsByPaymentId.get(refund.paymentId) ?? [];
      current.push(refund);
      refundsByPaymentId.set(refund.paymentId, current);
    }

    return refundsByPaymentId;
  }

  private toReceiptRefundSummary(amountKobo: number, refunds: PaymentRefundRow[]) {
    const processedRefundedKobo = refunds
      .filter((refund) => refund.status === "processed")
      .reduce((total, refund) => total + refund.amountKobo, 0);
    const hasRefundInProgress = refunds.some((refund) =>
      ["needs_attention", "pending", "processing"].includes(refund.status)
    );

    return {
      processedRefundedKobo,
      hasRefundInProgress,
      refundState: hasRefundInProgress
        ? "in_progress"
        : processedRefundedKobo <= 0
          ? "none"
          : processedRefundedKobo >= amountKobo
            ? "refunded"
            : "partially_refunded"
    };
  }

  private async findPaymentSetup(organisationId: string) {
    const [account] = await this.databaseService.db
      .select({
        id: organisationPaymentAccounts.id,
        bankName: organisationPaymentAccounts.bankName,
        accountNumberLast4: organisationPaymentAccounts.accountNumberLast4,
        providerSubaccountCode: organisationPaymentAccounts.providerSubaccountCode,
        status: organisationPaymentAccounts.status,
        disabledAt: organisationPaymentAccounts.disabledAt,
        updatedAt: organisationPaymentAccounts.updatedAt
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

    if (!account) {
      return {
        status: "not_configured" as const,
        canAcceptOnlinePayments: false
      };
    }

    const status =
      account.status === "active" && !account.disabledAt && account.providerSubaccountCode
        ? "active"
        : account.status === "disabled" || account.disabledAt
          ? "disabled"
          : "verification_delayed";

    return {
      status,
      canAcceptOnlinePayments: status === "active",
      bankName: account.bankName,
      accountNumberLast4: account.accountNumberLast4
    };
  }

  private bucketSql(
    column: SQL | typeof paymentRefunds.processedAt | typeof payments.paidAt,
    granularity: DashboardResolvedGranularity
  ) {
    if (granularity === "day") {
      return sql<string>`to_char(${column} at time zone ${dashboardTimezone}, 'YYYY-MM-DD')`;
    }

    if (granularity === "week") {
      return sql<string>`to_char(date_trunc('week', ${column} at time zone ${dashboardTimezone}), 'YYYY-MM-DD')`;
    }

    return sql<string>`to_char(date_trunc('month', ${column} at time zone ${dashboardTimezone}), 'YYYY-MM-01')`;
  }

  private resolvePeriod(query: DashboardOverviewQueryDto): DashboardPeriod {
    const dateTo = query.dateTo ?? this.lagosDateString(new Date());
    const dateFrom = query.dateFrom ?? this.addDays(dateTo, -29);
    const rangeDays = this.daysBetween(dateFrom, dateTo) + 1;

    if (rangeDays <= 0) {
      throw new BadRequestException("dateFrom must be on or before dateTo.");
    }

    if (rangeDays > maxDashboardRangeDays) {
      throw new BadRequestException("Dashboard date range cannot exceed 2 years.");
    }

    const granularity = this.resolveGranularity(query.granularity ?? "auto", rangeDays);

    return {
      dateFrom,
      dateTo,
      granularity,
      timezone: dashboardTimezone,
      utcStart: this.toLagosUtcStart(dateFrom),
      utcEndExclusive: this.toLagosUtcEndExclusive(dateTo)
    };
  }

  private resolveGranularity(
    granularity: DashboardOverviewQueryDto["granularity"],
    rangeDays: number
  ): DashboardResolvedGranularity {
    if (granularity && granularity !== "auto") {
      return granularity;
    }

    if (rangeDays <= 45) {
      return "day";
    }

    if (rangeDays <= 180) {
      return "week";
    }

    return "month";
  }

  private createTrendBuckets(
    dateFrom: string,
    dateTo: string,
    granularity: DashboardResolvedGranularity
  ) {
    const buckets: string[] = [];
    let cursor =
      granularity === "week"
        ? this.startOfWeek(dateFrom)
        : granularity === "month"
          ? this.startOfMonth(dateFrom)
          : dateFrom;

    while (cursor <= dateTo) {
      buckets.push(cursor);
      cursor =
        granularity === "day"
          ? this.addDays(cursor, 1)
          : granularity === "week"
            ? this.addDays(cursor, 7)
            : this.addMonths(cursor, 1);
    }

    return buckets;
  }

  private lagosDateString(date: Date) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      timeZone: dashboardTimezone,
      year: "numeric"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    return `${values.year}-${values.month}-${values.day}`;
  }

  private utcDateString(date: Date) {
    return this.formatDate(
      new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    );
  }

  private toLagosUtcStart(value: string) {
    const { day, month, year } = this.parseDate(value);
    return new Date(Date.UTC(year, month - 1, day) - lagosUtcOffsetMs);
  }

  private toLagosUtcEndExclusive(value: string) {
    const { day, month, year } = this.parseDate(value);
    return new Date(Date.UTC(year, month - 1, day + 1) - lagosUtcOffsetMs);
  }

  private daysBetween(left: string, right: string) {
    return Math.round((this.localDateUtcMs(right) - this.localDateUtcMs(left)) / dayMs);
  }

  private addDays(value: string, days: number) {
    return this.formatDate(new Date(this.localDateUtcMs(value) + days * dayMs));
  }

  private addMonths(value: string, months: number) {
    const { day, month, year } = this.parseDate(value);
    return this.formatDate(new Date(Date.UTC(year, month - 1 + months, day)));
  }

  private startOfMonth(value: string) {
    const { month, year } = this.parseDate(value);
    return this.formatDate(new Date(Date.UTC(year, month - 1, 1)));
  }

  private startOfWeek(value: string) {
    const date = new Date(this.localDateUtcMs(value));
    const dayOfWeek = date.getUTCDay();
    const daysSinceMonday = (dayOfWeek + 6) % 7;

    date.setUTCDate(date.getUTCDate() - daysSinceMonday);
    return this.formatDate(date);
  }

  private localDateUtcMs(value: string) {
    const { day, month, year } = this.parseDate(value);
    return Date.UTC(year, month - 1, day);
  }

  private parseDate(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (!match) {
      throw new BadRequestException("Dashboard dates must use YYYY-MM-DD format.");
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw new BadRequestException("Dashboard dates must be valid calendar dates.");
    }

    return { day, month, year };
  }

  private formatDate(date: Date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
      date.getUTCDate()
    ).padStart(2, "0")}`;
  }
}
