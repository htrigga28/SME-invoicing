import { BadRequestException } from "@nestjs/common";

import type { ActiveOrganisationContext } from "../../common/types/request-context";
import type { Invoice } from "../../database/schema";
import { DashboardService } from "./dashboard.service";

describe("DashboardService", () => {
  it("returns period activity, current position, recent activity, and safe payment setup state", async () => {
    const { databaseService, select } = createDatabaseService([
      [{ grossCollectedKobo: 120000, successfulPaymentCount: 2 }],
      [{ processedRefundsKobo: 20000, processedRefundCount: 1 }],
      [{ receiptsIssuedCount: 2 }],
      [{ period: "2026-07-01", grossCollectedKobo: 120000 }],
      [{ period: "2026-07-01", processedRefundsKobo: 20000 }],
      [
        {
          outstandingKobo: 50000,
          overdueKobo: 15000,
          outstandingInvoiceCount: 2,
          overdueInvoiceCount: 1
        }
      ],
      [
        { status: "sent", count: 1, balanceKobo: 35000 },
        { status: "overdue", count: 1, balanceKobo: 15000 },
        { status: "paid", count: 2, balanceKobo: 0 }
      ],
      [
        {
          notDueKobo: 35000,
          overdue1To7DaysKobo: 15000,
          overdue8To30DaysKobo: 0,
          overdue31PlusDaysKobo: 0
        }
      ],
      [
        {
          invoice: createInvoice(),
          customer: {
            id: "customer-1",
            name: "Lagos Bright Prints",
            email: "accounts@example.test"
          }
        }
      ],
      [
        {
          id: "receipt-1",
          receiptNumber: "RCT-000001",
          paymentId: "payment-1",
          invoiceId: "invoice-1",
          invoiceNumber: "INV-000001",
          customerId: "customer-1",
          customerName: "Lagos Bright Prints",
          amountKobo: 120000,
          currency: "NGN",
          issuedAt: new Date("2026-07-01T10:01:00.000Z")
        }
      ],
      [
        {
          id: "payment-account-1",
          bankName: "Access Bank",
          accountNumberLast4: "7890",
          providerSubaccountCode: "ACCT_secret",
          status: "active",
          disabledAt: null,
          updatedAt: new Date("2026-07-01T10:00:00.000Z")
        }
      ],
      [{ paymentId: "payment-1", amountKobo: 10000, status: "pending" }]
    ]);
    const paymentsService = {
      getPaymentSummary: jest.fn().mockResolvedValue({
        totals: {
          pendingCount: 2,
          stalePendingCount: 1,
          reviewRequiredCount: 4
        }
      }),
      listPayments: jest
        .fn()
        .mockResolvedValueOnce({
          payments: [
            {
              id: "payment-1",
              providerReference: "SME-INV-000001-ABC",
              amountKobo: 120000,
              currency: "NGN",
              attemptState: "successful",
              status: "successful",
              paidAt: new Date("2026-07-01T10:00:00.000Z"),
              createdAt: new Date("2026-07-01T09:58:00.000Z"),
              invoice: {
                id: "invoice-1",
                invoiceNumber: "INV-000001"
              },
              customer: {
                id: "customer-1",
                name: "Lagos Bright Prints"
              }
            }
          ]
        })
        .mockResolvedValueOnce({
          payments: [
            {
              id: "payment-review-1",
              reviewReason: "Successful payments exceed the invoice total.",
              reconciliationState: "overpaid",
              reviewState: "open",
              amountKobo: 120000,
              createdAt: new Date("2026-07-01T10:00:00.000Z"),
              invoice: {
                id: "invoice-1",
                invoiceNumber: "INV-000001"
              },
              customer: {
                id: "customer-1",
                name: "Lagos Bright Prints"
              }
            }
          ]
        })
    };
    const service = new DashboardService(databaseService as never, paymentsService as never);

    const response = await service.getOverview(createContext(), {
      dateFrom: "2026-07-01",
      dateTo: "2026-07-01"
    });

    expect(select).toHaveBeenCalledTimes(12);
    expect(paymentsService.getPaymentSummary).toHaveBeenCalledWith(createContext(), {});
    expect(response.financialActivity).toEqual({
      grossCollectedKobo: 120000,
      processedRefundsKobo: 20000,
      netCollectedKobo: 100000,
      successfulPaymentCount: 2,
      processedRefundCount: 1,
      receiptsIssuedCount: 2
    });
    expect(response.currentPosition).toEqual({
      outstandingKobo: 50000,
      overdueKobo: 15000,
      outstandingInvoiceCount: 2,
      overdueInvoiceCount: 1,
      activePendingPaymentCount: 3,
      unresolvedReviewCount: 4
    });
    expect(response.invoiceStatusBreakdown).toContainEqual({
      status: "sent",
      count: 1,
      balanceKobo: 35000
    });
    expect(response.recentReceipts[0]?.refundSummary).toEqual({
      processedRefundedKobo: 0,
      hasRefundInProgress: true,
      refundState: "in_progress"
    });
    expect(response.paymentSetup).toEqual({
      status: "active",
      canAcceptOnlinePayments: true,
      bankName: "Access Bank",
      accountNumberLast4: "7890"
    });
  });

  it("rejects invalid or excessive dashboard date ranges before querying", async () => {
    const { databaseService, select } = createDatabaseService([]);
    const service = new DashboardService(
      databaseService as never,
      {
        getPaymentSummary: jest.fn(),
        listPayments: jest.fn()
      } as never
    );

    await expect(
      service.getOverview(createContext(), {
        dateFrom: "2026-07-02",
        dateTo: "2026-07-01"
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.getOverview(createContext(), {
        dateFrom: "2024-01-01",
        dateTo: "2026-07-07"
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(select).not.toHaveBeenCalled();
  });
});

function createDatabaseService(results: unknown[][]) {
  const queuedResults = [...results];
  const select = jest.fn(() => createQuery(queuedResults.shift() ?? []));

  return {
    databaseService: {
      db: {
        select
      }
    },
    select
  };
}

function createQuery(result: unknown[]) {
  const query = {
    from: () => query,
    groupBy: () => Promise.resolve(result),
    innerJoin: () => query,
    limit: () => Promise.resolve(result),
    orderBy: () => query,
    then: <TResult1 = unknown[], TResult2 = never>(
      onfulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) => Promise.resolve(result).then(onfulfilled, onrejected),
    where: () => query
  };

  return query;
}

function createContext(): ActiveOrganisationContext {
  return {
    user: {
      id: "user-1",
      email: "owner@demo.com",
      name: "Demo Owner",
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      updatedAt: new Date("2026-07-01T00:00:00.000Z")
    },
    activeOrganisation: {
      id: "org-1",
      name: "Demo Org",
      slug: "demo-org",
      onboardingCompletedAt: new Date("2026-07-01T00:00:00.000Z"),
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      updatedAt: new Date("2026-07-01T00:00:00.000Z")
    },
    membership: {
      id: "member-1",
      organisationId: "org-1",
      userId: "user-1",
      role: "owner",
      status: "active",
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      updatedAt: new Date("2026-07-01T00:00:00.000Z")
    },
    businessProfile: {
      id: "profile-1",
      organisationId: "org-1",
      businessName: "Demo Business Ltd",
      email: "billing@example.test",
      phone: "+2348012345678",
      address: "Lagos",
      logoFileId: null,
      setupCompletedAt: new Date("2026-07-01T00:00:00.000Z"),
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      updatedAt: new Date("2026-07-01T00:00:00.000Z")
    }
  };
}

function createInvoice(): Invoice {
  return {
    id: "invoice-1",
    organisationId: "org-1",
    customerId: "customer-1",
    invoiceNumber: "INV-000001",
    publicToken: "public-token",
    publicAccessEnabled: true,
    status: "sent",
    currency: "NGN",
    issueDate: "2026-07-01",
    dueDate: "2026-07-20",
    notes: null,
    subtotalKobo: 50000,
    discountKobo: 0,
    taxKobo: 0,
    totalKobo: 50000,
    amountPaidKobo: 0,
    balanceDueKobo: 50000,
    sentAt: new Date("2026-07-01T00:00:00.000Z"),
    viewedAt: null,
    paidAt: null,
    cancelledAt: null,
    voidedAt: null,
    createdByUserId: "user-1",
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z")
  };
}
