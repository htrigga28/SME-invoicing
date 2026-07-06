import "dotenv/config";

import { createHmac } from "crypto";
import * as argon2 from "argon2";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import {
  businessProfiles,
  customers,
  invoiceLineItems,
  invoiceNumberSequences,
  invoices,
  invoiceStatusEvents,
  organisationPaymentAccounts,
  organisationInvitations,
  organisationMembers,
  organisations,
  paymentEvents,
  payments,
  receipts,
  users
} from "./schema";

const demoPassword = "DemoPass123!";
const organisationSlug = "akin-co-demo";
const organisationName = "Akin & Co Creative Services";
const frontendUrl = (process.env.FRONTEND_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

const demoUsers = [
  { email: "owner@demo.com", name: "Demo Owner", role: "owner" },
  { email: "admin@demo.com", name: "Demo Admin", role: "admin" },
  { email: "accountant@demo.com", name: "Demo Accountant", role: "accountant" },
  { email: "viewer@demo.com", name: "Demo Viewer", role: "viewer" }
] as const;

const demoInvitations = [
  {
    email: "pending.accountant@demo.com",
    role: "accountant",
    status: "pending",
    token: "dev-pending-accountant-demo-token",
    daysFromNow: 7
  },
  {
    email: "pending.viewer@demo.com",
    role: "viewer",
    status: "pending",
    token: "dev-pending-viewer-demo-token",
    daysFromNow: 7
  },
  {
    email: "expired.viewer@demo.com",
    role: "viewer",
    status: "expired",
    token: "dev-expired-viewer-demo-token",
    daysFromNow: -1
  },
  {
    email: "revoked.accountant@demo.com",
    role: "accountant",
    status: "revoked",
    token: "dev-revoked-accountant-demo-token",
    daysFromNow: 7
  }
] as const;

const demoCustomers = [
  {
    name: "Lagos Bright Prints",
    email: "accounts@lagosbrightprints.com",
    phone: "+2348010000001",
    billingAddress: "14 Allen Avenue, Ikeja, Lagos"
  },
  {
    name: "Northstar Foods Ltd",
    email: "finance@northstarfoods.com",
    phone: "+2348010000002",
    billingAddress: "22 Ahmadu Bello Way, Victoria Island, Lagos"
  },
  {
    name: "Lekki Dental Studio",
    email: "billing@lekkidental.com",
    phone: "+2348010000003",
    billingAddress: "8 Admiralty Road, Lekki Phase 1, Lagos"
  },
  {
    name: "BluePeak Logistics",
    email: "ops@bluepeaklogistics.com",
    phone: "+2348010000004",
    billingAddress: "31 Airport Road, Ikeja, Lagos"
  },
  {
    name: "Abuja Creative Hub",
    email: "admin@abujacreativehub.com",
    phone: "+2348010000005",
    billingAddress: "6 Gana Street, Maitama, Abuja"
  },
  {
    name: "Prime Tutors Academy",
    email: "bursar@primetutors.com",
    phone: "+2348010000006",
    billingAddress: "10 Toyin Street, Ikeja, Lagos"
  },
  {
    name: "Mainland Events Co",
    email: "payments@mainlandevents.com",
    phone: "+2348010000007",
    billingAddress: "44 Bode Thomas Street, Surulere, Lagos"
  },
  {
    name: "Greenline Pharmacy",
    email: "accounts@greenlinepharmacy.com",
    phone: "+2348010000008",
    billingAddress: "19 Herbert Macaulay Way, Yaba, Lagos"
  },
  {
    name: "Coral Edge Consulting",
    email: "finance@coraledge.com",
    phone: "+2348010000009",
    billingAddress: "2 Ligali Ayorinde Street, Victoria Island, Lagos"
  },
  {
    name: "Swift Repairs NG",
    email: "billing@swiftrepairs.com",
    phone: "+2348010000010",
    billingAddress: "15 Ikorodu Road, Maryland, Lagos"
  },
  {
    name: "Archived Customer One",
    email: "archived.one@example.com",
    phone: "+2348010000011",
    billingAddress: "1 Old Marina Road, Lagos",
    archived: true
  },
  {
    name: "Archived Customer Two",
    email: "archived.two@example.com",
    phone: "+2348010000012",
    billingAddress: "2 Old Marina Road, Lagos",
    archived: true
  }
] as const;

const invoiceStatuses = [
  ...Array.from({ length: 6 }, () => "draft" as const),
  ...Array.from({ length: 6 }, () => "sent" as const),
  ...Array.from({ length: 4 }, () => "viewed" as const),
  ...Array.from({ length: 5 }, () => "overdue" as const),
  ...Array.from({ length: 2 }, () => "cancelled" as const),
  "void" as const
];
type SeedInvoiceStatus = (typeof invoiceStatuses)[number];
type SeedInvoiceEvent = {
  createdAt: Date;
  fromStatus: SeedInvoiceStatus | null;
  reason: string;
  toStatus: SeedInvoiceStatus;
};

const serviceLineItems = [
  ["Brand strategy workshop", 1, 180000],
  ["Monthly bookkeeping support", 1, 220000],
  ["Social media campaign design", 2, 95000],
  ["Website maintenance retainer", 1, 150000],
  ["Delivery route planning", 1, 125000],
  ["Printed marketing materials", 4, 35000],
  ["Staff training session", 2, 80000],
  ["Dental equipment servicing", 1, 175000],
  ["Event production coordination", 1, 300000],
  ["Business advisory session", 3, 60000]
] as const;

const demoHistoricalSubaccountCode = "ACCT_demo_historical";

function invoiceDate(daysFromNow: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

function calculateSeedTotals(
  lineItems: { quantity: number; unitPriceKobo: number }[],
  discountKobo: number,
  taxKobo: number
) {
  const lineTotals = lineItems.map((lineItem) =>
    Math.round(lineItem.quantity * lineItem.unitPriceKobo)
  );
  const subtotalKobo = lineTotals.reduce((sum, lineTotal) => sum + lineTotal, 0);
  const totalKobo = subtotalKobo - discountKobo + taxKobo;

  return {
    lineTotals,
    subtotalKobo,
    totalKobo,
    balanceDueKobo: totalKobo
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run the development seed.");
  }

  if (!refreshSecret) {
    throw new Error("JWT_REFRESH_SECRET is required to hash development invitation tokens.");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);
  const now = new Date();
  const passwordHash = await argon2.hash(demoPassword);

  try {
    const [organisation] = await db
      .insert(organisations)
      .values({
        name: organisationName,
        slug: organisationSlug,
        onboardingCompletedAt: now
      })
      .onConflictDoUpdate({
        target: organisations.slug,
        set: {
          name: organisationName,
          onboardingCompletedAt: now,
          updatedAt: now
        }
      })
      .returning();

    if (!organisation) {
      throw new Error("Demo organisation could not be created.");
    }

    await db
      .insert(businessProfiles)
      .values({
        organisationId: organisation.id,
        businessName: organisationName,
        email: "billing@akinco.com",
        phone: "+2348012345678",
        address: "12 Admiralty Way, Lekki Phase 1, Lagos, Nigeria",
        setupCompletedAt: now
      })
      .onConflictDoUpdate({
        target: businessProfiles.organisationId,
        set: {
          businessName: organisationName,
          email: "billing@akinco.com",
          phone: "+2348012345678",
          address: "12 Admiralty Way, Lekki Phase 1, Lagos, Nigeria",
          setupCompletedAt: now,
          updatedAt: now
        }
      });

    const seededUsers = new Map<string, { id: string }>();

    for (const demoUser of demoUsers) {
      const [user] = await db
        .insert(users)
        .values({
          email: demoUser.email,
          name: demoUser.name,
          passwordHash
        })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            name: demoUser.name,
            passwordHash,
            updatedAt: now
          }
        })
        .returning();

      if (!user) {
        throw new Error(`Demo user could not be created: ${demoUser.email}`);
      }

      seededUsers.set(demoUser.email, { id: user.id });

      const [existingMembership] = await db
        .select()
        .from(organisationMembers)
        .where(
          and(
            eq(organisationMembers.organisationId, organisation.id),
            eq(organisationMembers.userId, user.id)
          )
        )
        .limit(1);

      if (existingMembership) {
        await db
          .update(organisationMembers)
          .set({
            role: demoUser.role,
            status: "active",
            updatedAt: now
          })
          .where(eq(organisationMembers.id, existingMembership.id));
      } else {
        await db.insert(organisationMembers).values({
          organisationId: organisation.id,
          userId: user.id,
          role: demoUser.role,
          status: "active"
        });
      }
    }

    const owner = seededUsers.get("owner@demo.com");

    if (!owner) {
      throw new Error("Demo owner was not seeded.");
    }

    const pendingInviteUrls: string[] = [];

    for (const invitation of demoInvitations) {
      const tokenHash = createHmac("sha256", refreshSecret).update(invitation.token).digest("hex");
      const expiresAt = new Date(now.getTime() + invitation.daysFromNow * 24 * 60 * 60 * 1000);
      const revokedAt = invitation.status === "revoked" ? now : null;

      const [existingInvitation] = await db
        .select()
        .from(organisationInvitations)
        .where(
          and(
            eq(organisationInvitations.organisationId, organisation.id),
            eq(organisationInvitations.email, invitation.email),
            eq(organisationInvitations.status, invitation.status)
          )
        )
        .limit(1);

      if (existingInvitation) {
        await db
          .update(organisationInvitations)
          .set({
            tokenHash,
            role: invitation.role,
            invitedByUserId: owner.id,
            expiresAt,
            revokedAt,
            updatedAt: now
          })
          .where(eq(organisationInvitations.id, existingInvitation.id));
      } else {
        await db.insert(organisationInvitations).values({
          organisationId: organisation.id,
          email: invitation.email,
          tokenHash,
          role: invitation.role,
          status: invitation.status,
          invitedByUserId: owner.id,
          expiresAt,
          revokedAt
        });
      }

      if (invitation.status === "pending") {
        pendingInviteUrls.push(`${frontendUrl}/accept-invite/${invitation.token}`);
      }
    }

    for (const customer of demoCustomers) {
      const archivedAt = "archived" in customer && customer.archived ? now : null;
      const [existingCustomer] = await db
        .select()
        .from(customers)
        .where(
          and(eq(customers.organisationId, organisation.id), eq(customers.email, customer.email))
        )
        .limit(1);
      const [existingCustomerByName] = existingCustomer
        ? [existingCustomer]
        : await db
            .select()
            .from(customers)
            .where(
              and(eq(customers.organisationId, organisation.id), eq(customers.name, customer.name))
            )
            .limit(1);
      const customerToUpdate = existingCustomer ?? existingCustomerByName;

      if (customerToUpdate) {
        await db
          .update(customers)
          .set({
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            billingAddress: customer.billingAddress,
            archivedAt,
            updatedAt: now
          })
          .where(eq(customers.id, customerToUpdate.id));
      } else {
        await db.insert(customers).values({
          organisationId: organisation.id,
          createdByUserId: owner.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          billingAddress: customer.billingAddress,
          archivedAt
        });
      }
    }

    const activeCustomers = await db
      .select()
      .from(customers)
      .where(
        and(eq(customers.organisationId, organisation.id), sql`${customers.archivedAt} is null`)
      );
    const activeCustomerByEmail = new Map(
      activeCustomers.map((customer) => [customer.email, customer])
    );
    const activeCustomerEmails = demoCustomers
      .filter((customer) => !("archived" in customer && customer.archived))
      .map((customer) => customer.email);
    const publicInvoiceUrls: string[] = [];

    for (const [index, status] of invoiceStatuses.entries()) {
      const sequenceNumber = index + 1;
      const invoiceNumber = `INV-${sequenceNumber.toString().padStart(6, "0")}`;
      const customerEmail = activeCustomerEmails[index % activeCustomerEmails.length];

      if (!customerEmail) {
        throw new Error("No active demo customers were found for invoice seeding.");
      }

      const customer = activeCustomerByEmail.get(customerEmail);

      if (!customer) {
        throw new Error(`Seed customer was not found for invoice: ${customerEmail}`);
      }

      const issueDate =
        status === "overdue" ? invoiceDate(-60 + index) : invoiceDate(-20 + index * 2);
      const dueDate = status === "overdue" ? invoiceDate(-15 + index) : invoiceDate(10 + index * 2);
      const itemCount = (index % 5) + 1;
      const selectedLineItems = Array.from({ length: itemCount }, (_value, itemIndex) => {
        const serviceLineItem = serviceLineItems[(index + itemIndex) % serviceLineItems.length];

        if (!serviceLineItem) {
          throw new Error("Seed line item was not found.");
        }

        const [description, quantity, unitPriceKobo] = serviceLineItem;
        return {
          description,
          quantity,
          unitPriceKobo
        };
      });
      const discountKobo = index % 4 === 0 ? 10000 : 0;
      const taxKobo = index % 3 === 0 ? 7500 : 0;
      const totals = calculateSeedTotals(selectedLineItems, discountKobo, taxKobo);
      const sentAt = ["sent", "viewed", "overdue", "cancelled", "void"].includes(status)
        ? new Date(`${issueDate}T09:00:00.000Z`)
        : null;
      const viewedAt = ["viewed", "overdue"].includes(status)
        ? new Date(`${issueDate}T12:00:00.000Z`)
        : null;
      const cancelledAt = status === "cancelled" ? new Date(`${dueDate}T10:00:00.000Z`) : null;
      const voidedAt = status === "void" ? new Date(`${dueDate}T10:00:00.000Z`) : null;
      const publicToken = createHmac("sha256", refreshSecret)
        .update(`invoice:${invoiceNumber}`)
        .digest("hex");

      if (["sent", "viewed", "overdue"].includes(status) && publicInvoiceUrls.length < 3) {
        publicInvoiceUrls.push(`${frontendUrl}/invoice/${publicToken}`);
      }

      const [existingInvoice] = await db
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.organisationId, organisation.id),
            eq(invoices.invoiceNumber, invoiceNumber)
          )
        )
        .limit(1);

      const invoiceValues = {
        organisationId: organisation.id,
        customerId: customer.id,
        invoiceNumber,
        publicToken,
        publicAccessEnabled: ["sent", "viewed", "overdue"].includes(status),
        status,
        currency: "NGN",
        issueDate,
        dueDate,
        notes: `Demo ${status.replace("_", " ")} invoice for portfolio walkthrough.`,
        subtotalKobo: totals.subtotalKobo,
        discountKobo,
        taxKobo,
        totalKobo: totals.totalKobo,
        amountPaidKobo: 0,
        balanceDueKobo: totals.balanceDueKobo,
        sentAt,
        viewedAt,
        paidAt: null,
        cancelledAt,
        voidedAt,
        createdByUserId: owner.id,
        updatedAt: now
      };

      const [invoice] = existingInvoice
        ? await db
            .update(invoices)
            .set(invoiceValues)
            .where(eq(invoices.id, existingInvoice.id))
            .returning()
        : await db.insert(invoices).values(invoiceValues).returning();

      if (!invoice) {
        throw new Error(`Demo invoice could not be created: ${invoiceNumber}`);
      }

      await db.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoice.id));
      await db.delete(invoiceStatusEvents).where(eq(invoiceStatusEvents.invoiceId, invoice.id));

      await db.insert(invoiceLineItems).values(
        selectedLineItems.map((lineItem, itemIndex) => ({
          organisationId: organisation.id,
          invoiceId: invoice.id,
          description: lineItem.description,
          quantity: lineItem.quantity.toFixed(2),
          unitPriceKobo: lineItem.unitPriceKobo,
          lineTotalKobo: totals.lineTotals[itemIndex] ?? 0,
          sortOrder: itemIndex
        }))
      );

      const events: SeedInvoiceEvent[] = [
        {
          fromStatus: null,
          toStatus: "draft" as const,
          reason: "invoice_created",
          createdAt: new Date(`${issueDate}T08:00:00.000Z`)
        }
      ];

      if (status !== "draft") {
        events.push({
          fromStatus: "draft",
          toStatus: status === "cancelled" || status === "void" ? "sent" : status,
          reason:
            status === "sent" || status === "cancelled" || status === "void"
              ? "invoice_sent"
              : `invoice_${status}`,
          createdAt: sentAt ?? now
        });
      }

      if (status === "cancelled") {
        events.push({
          fromStatus: "sent",
          toStatus: "cancelled",
          reason: "Demo cancellation",
          createdAt: cancelledAt ?? now
        });
      }

      if (status === "void") {
        events.push({
          fromStatus: "sent",
          toStatus: "void",
          reason: "Demo void",
          createdAt: voidedAt ?? now
        });
      }

      await db.insert(invoiceStatusEvents).values(
        events.map((event) => ({
          organisationId: organisation.id,
          invoiceId: invoice.id,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          reason: event.reason,
          actorUserId: owner.id,
          metadataRedacted: { invoiceNumber },
          createdAt: event.createdAt
        }))
      );
    }

    const [existingHistoricalPaymentAccount] = await db
      .select()
      .from(organisationPaymentAccounts)
      .where(
        and(
          eq(organisationPaymentAccounts.organisationId, organisation.id),
          eq(organisationPaymentAccounts.providerSubaccountCode, demoHistoricalSubaccountCode)
        )
      )
      .limit(1);

    const historicalPaymentAccountValues = {
      organisationId: organisation.id,
      provider: "paystack" as const,
      providerSubaccountCode: demoHistoricalSubaccountCode,
      bankCode: "033",
      bankName: "United Bank for Africa",
      accountName: "Akin & Co Creative Services",
      accountNumberLast4: "9090",
      status: "disabled" as const,
      verifiedAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
      disabledAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      providerMetadataRedacted: {
        provider: "paystack",
        seed: "historical_demo_settlement_account"
      },
      createdByUserId: owner.id,
      updatedAt: now
    };

    const [historicalPaymentAccount] = existingHistoricalPaymentAccount
      ? await db
          .update(organisationPaymentAccounts)
          .set(historicalPaymentAccountValues)
          .where(eq(organisationPaymentAccounts.id, existingHistoricalPaymentAccount.id))
          .returning()
      : await db
          .insert(organisationPaymentAccounts)
          .values(historicalPaymentAccountValues)
          .returning();

    if (!historicalPaymentAccount) {
      throw new Error("Demo historical payment account could not be seeded.");
    }

    await db
      .delete(receipts)
      .where(
        and(
          eq(receipts.organisationId, organisation.id),
          eq(receipts.paymentProvider, "paystack"),
          sql`${receipts.paymentReference} like 'PAYSTACK_DEMO_%'`
        )
      );
    await db
      .delete(paymentEvents)
      .where(
        and(
          eq(paymentEvents.provider, "paystack"),
          sql`(${paymentEvents.providerReference} like 'PAYSTACK_DEMO_%' or ${paymentEvents.providerReference} like 'PAYSTACK_REVIEW_%')`
        )
      );
    await db
      .delete(payments)
      .where(
        and(
          eq(payments.organisationId, organisation.id),
          eq(payments.provider, "paystack"),
          sql`${payments.providerReference} like 'PAYSTACK_DEMO_%'`
        )
      );

    const seededInvoices = await db
      .select()
      .from(invoices)
      .where(eq(invoices.organisationId, organisation.id));
    const invoiceByNumber = new Map(
      seededInvoices.map((invoice) => [invoice.invoiceNumber, invoice])
    );

    const fullPaymentInvoiceNumbers = [
      "INV-000011",
      "INV-000012",
      "INV-000013",
      "INV-000014",
      "INV-000015",
      "INV-000016"
    ];
    const partialPaymentInvoiceNumbers = ["INV-000017", "INV-000018", "INV-000019", "INV-000020"];
    const pendingPaymentInvoiceNumbers = ["INV-000007", "INV-000008", "INV-000009"];
    const failedPaymentInvoiceNumbers = ["INV-000010"];
    const abandonedPaymentInvoiceNumbers = ["INV-000021"];
    const supersededRetryRows = [
      { invoiceNumber: "INV-000011", status: "pending" as const, suffix: "RETRY_PENDING" },
      { invoiceNumber: "INV-000012", status: "failed" as const, suffix: "RETRY_FAILED" },
      { invoiceNumber: "INV-000013", status: "abandoned" as const, suffix: "RETRY_ABANDONED" }
    ];

    const seededPaymentRows: {
      amountKobo: number;
      eventErrorMessage?: string | null;
      eventAmountKobo?: number;
      eventType?: string;
      invoiceNumber: string;
      offsetDays: number;
      referenceSuffix?: string;
      status: "abandoned" | "failed" | "pending" | "successful";
    }[] = [
      ...fullPaymentInvoiceNumbers.map((invoiceNumber, index) => {
        const invoice = invoiceByNumber.get(invoiceNumber);

        if (!invoice) {
          throw new Error(`Seed invoice was not found for payment: ${invoiceNumber}`);
        }

        return {
          invoiceNumber,
          amountKobo: invoice.totalKobo,
          status: "successful" as const,
          offsetDays: 18 - index
        };
      }),
      ...partialPaymentInvoiceNumbers.map((invoiceNumber, index) => {
        const invoice = invoiceByNumber.get(invoiceNumber);

        if (!invoice) {
          throw new Error(`Seed invoice was not found for payment: ${invoiceNumber}`);
        }

        return {
          invoiceNumber,
          amountKobo: Math.max(Math.floor(invoice.totalKobo * 0.4), 1000),
          status: "successful" as const,
          offsetDays: 12 - index
        };
      }),
      ...pendingPaymentInvoiceNumbers.map((invoiceNumber, index) => ({
        invoiceNumber,
        amountKobo: invoiceByNumber.get(invoiceNumber)?.balanceDueKobo ?? 0,
        status: "pending" as const,
        offsetDays: index === 0 ? 0 : 5 - index,
        eventErrorMessage:
          invoiceNumber === "INV-000009"
            ? "Payment amount did not match the pending payment."
            : null,
        ...(invoiceNumber === "INV-000009"
          ? {
              eventAmountKobo: Math.max(
                (invoiceByNumber.get(invoiceNumber)?.balanceDueKobo ?? 0) - 10000,
                0
              )
            }
          : {})
      })),
      ...failedPaymentInvoiceNumbers.map((invoiceNumber, index) => ({
        invoiceNumber,
        amountKobo: invoiceByNumber.get(invoiceNumber)?.balanceDueKobo ?? 0,
        status: "failed" as const,
        offsetDays: 4 - index,
        eventType: "charge.failed"
      })),
      ...abandonedPaymentInvoiceNumbers.map((invoiceNumber) => ({
        invoiceNumber,
        amountKobo: invoiceByNumber.get(invoiceNumber)?.balanceDueKobo ?? 0,
        status: "abandoned" as const,
        offsetDays: 2
      })),
      ...supersededRetryRows.map((row, index) => {
        const paymentSeed = {
          invoiceNumber: row.invoiceNumber,
          amountKobo: invoiceByNumber.get(row.invoiceNumber)?.totalKobo ?? 0,
          status: row.status,
          offsetDays: 1 + index,
          referenceSuffix: row.suffix
        };

        return row.status === "failed"
          ? { ...paymentSeed, eventType: "charge.failed" }
          : paymentSeed;
      })
    ];

    for (const paymentSeed of seededPaymentRows) {
      const invoice = invoiceByNumber.get(paymentSeed.invoiceNumber);

      if (!invoice) {
        throw new Error(`Seed invoice was not found for payment: ${paymentSeed.invoiceNumber}`);
      }

      const customer = activeCustomers.find((item) => item.id === invoice.customerId);

      if (!customer) {
        throw new Error(`Seed customer was not found for payment: ${paymentSeed.invoiceNumber}`);
      }

      const createdAt = new Date(now.getTime() - paymentSeed.offsetDays * 24 * 60 * 60 * 1000);
      const providerReference = `PAYSTACK_DEMO_${paymentSeed.invoiceNumber.replace("-", "")}_${paymentSeed.referenceSuffix ?? paymentSeed.status.toUpperCase()}`;
      const paidAt = paymentSeed.status === "successful" ? createdAt : null;
      const failedAt = paymentSeed.status === "failed" ? createdAt : null;
      const abandonedAt = paymentSeed.status === "abandoned" ? createdAt : null;

      const [payment] = await db
        .insert(payments)
        .values({
          organisationId: organisation.id,
          invoiceId: invoice.id,
          customerId: customer.id,
          provider: "paystack",
          providerReference,
          providerSubaccountCode: demoHistoricalSubaccountCode,
          providerAccessCode: `demo_access_${paymentSeed.invoiceNumber}`,
          providerAuthorizationUrl: `https://checkout.paystack.com/demo-${paymentSeed.invoiceNumber.toLowerCase()}`,
          status: paymentSeed.status,
          currency: "NGN",
          amountKobo: paymentSeed.amountKobo,
          paidAt,
          failedAt,
          abandonedAt,
          channel: paymentSeed.status === "successful" ? "card" : null,
          gatewayResponse:
            paymentSeed.status === "successful"
              ? "Successful"
              : paymentSeed.status === "failed"
                ? "Declined"
                : null,
          metadataRedacted: {
            seed: "demo_payment",
            invoiceNumber: invoice.invoiceNumber,
            provider: "paystack"
          },
          initializedAt: createdAt,
          createdAt,
          updatedAt: now
        })
        .returning();

      if (!payment) {
        throw new Error(`Demo payment could not be seeded: ${providerReference}`);
      }

      if (paymentSeed.status === "successful") {
        const amountPaidKobo = paymentSeed.amountKobo;
        const balanceDueKobo = Math.max(invoice.totalKobo - amountPaidKobo, 0);
        const nextStatus = balanceDueKobo === 0 ? "paid" : "partially_paid";

        await db
          .update(invoices)
          .set({
            amountPaidKobo,
            balanceDueKobo,
            status: nextStatus,
            paidAt: nextStatus === "paid" ? paidAt : null,
            updatedAt: now
          })
          .where(eq(invoices.id, invoice.id));

        await db.insert(invoiceStatusEvents).values({
          organisationId: organisation.id,
          invoiceId: invoice.id,
          fromStatus: invoice.status,
          toStatus: nextStatus,
          reason: "payment_webhook_reconciled",
          actorUserId: null,
          metadataRedacted: {
            paymentId: payment.id,
            providerReference,
            amountPaidKobo,
            balanceDueKobo
          },
          createdAt
        });
      }

      if (
        paymentSeed.status === "successful" ||
        paymentSeed.status === "failed" ||
        paymentSeed.eventErrorMessage
      ) {
        await db.insert(paymentEvents).values({
          organisationId: organisation.id,
          paymentId: payment.id,
          provider: "paystack",
          providerEventId: `demo_${providerReference}`,
          providerReference,
          eventType: paymentSeed.eventType ?? "charge.success",
          signatureValid: true,
          processed: true,
          processedAt: createdAt,
          payloadRedacted: {
            event: paymentSeed.eventType ?? "charge.success",
            data: {
              reference: providerReference,
              amount: paymentSeed.eventAmountKobo ?? paymentSeed.amountKobo,
              currency: "NGN",
              status: paymentSeed.status,
              gateway_response: payment.gatewayResponse,
              channel: payment.channel,
              paid_at: paidAt?.toISOString(),
              customer: {
                email: customer.email
              },
              metadata: {
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                customerId: customer.id,
                organisationId: organisation.id,
                source: "seed"
              }
            }
          },
          errorMessage:
            paymentSeed.eventErrorMessage ??
            (paymentSeed.status === "failed" ? "Unsupported Paystack event ignored." : null),
          createdAt
        });
      }
    }

    await db.insert(paymentEvents).values({
      organisationId: organisation.id,
      paymentId: null,
      provider: "paystack",
      providerEventId: "demo_PAYSTACK_REVIEW_UNKNOWN_REF",
      providerReference: "PAYSTACK_REVIEW_UNKNOWN_REF",
      eventType: "charge.success",
      signatureValid: true,
      processed: true,
      processedAt: now,
      payloadRedacted: {
        event: "charge.success",
        data: {
          reference: "PAYSTACK_REVIEW_UNKNOWN_REF",
          amount: 100000,
          currency: "NGN",
          status: "success",
          gateway_response: "Successful",
          source: "seed"
        }
      },
      errorMessage: "Unknown payment reference.",
      createdAt: now
    });

    await db
      .insert(invoiceNumberSequences)
      .values({ organisationId: organisation.id, nextNumber: 25, updatedAt: now })
      .onConflictDoUpdate({
        target: invoiceNumberSequences.organisationId,
        set: {
          nextNumber: sql`greatest(${invoiceNumberSequences.nextNumber}, 25)`,
          updatedAt: now
        }
      });

    console.log("Development seed complete.");
    console.log(`Demo organisation: ${organisationName}`);
    console.log("Demo password for all seeded users: DemoPass123!");
    console.log(`Seeded demo customers: ${demoCustomers.length}`);
    console.log(`Seeded demo invoices: ${invoiceStatuses.length}`);
    console.log("Sample public invoice URLs:");
    for (const invoiceUrl of publicInvoiceUrls) {
      console.log(`- ${invoiceUrl}`);
    }
    console.log(
      "Dev-only pending invite URLs. Raw tokens are printed here only and are not stored:"
    );
    for (const inviteUrl of pendingInviteUrls) {
      console.log(`- ${inviteUrl}`);
    }
  } finally {
    await pool.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
