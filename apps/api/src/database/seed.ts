import "../config/load-root-env";

import { createHmac } from "crypto";
import * as argon2 from "argon2";
import { ConfigService } from "@nestjs/config";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import {
  businessProfiles,
  catalogueItems,
  communicationEvents,
  communicationRecipients,
  communications,
  customers,
  invoiceLineItems,
  invoiceNumberSequences,
  invoices,
  invoiceStatusEvents,
  invoiceViewEvents,
  automationJobs, organisationPaymentAccounts,
  organisationInvitations,
  organisationMembers, organisationReminderSettings,
  organisations, recurringInvoiceOccurrences, recurringInvoiceScheduleLineItems, recurringInvoiceSchedules, reminderSteps,
  paymentEvents,
  payments,
  users
} from "./schema";
import { ReceiptsService } from "../modules/receipts/receipts.service";

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

function demoCustomer(
  name: string,
  email: string,
  phone: string,
  billingAddress: string,
  archived = false
) {
  return { name, email, phone, billingAddress, archived };
}

const demoCustomers = [
  demoCustomer(
    "Lagos Bright Prints",
    "accounts@lagosbrightprints.com",
    "+2348010000001",
    "14 Allen Avenue, Ikeja, Lagos"
  ),
  demoCustomer(
    "Northstar Foods Ltd",
    "finance@northstarfoods.com",
    "+2348010000002",
    "22 Ahmadu Bello Way, Victoria Island, Lagos"
  ),
  demoCustomer(
    "Lekki Dental Studio",
    "billing@lekkidental.com",
    "+2348010000003",
    "8 Admiralty Road, Lekki Phase 1, Lagos"
  ),
  demoCustomer(
    "BluePeak Logistics",
    "ops@bluepeaklogistics.com",
    "+2348010000004",
    "31 Airport Road, Ikeja, Lagos"
  ),
  demoCustomer(
    "Abuja Creative Hub",
    "admin@abujacreativehub.com",
    "+2348010000005",
    "6 Gana Street, Maitama, Abuja"
  ),
  demoCustomer(
    "Prime Tutors Academy",
    "bursar@primetutors.com",
    "+2348010000006",
    "10 Toyin Street, Ikeja, Lagos"
  ),
  demoCustomer(
    "Mainland Events Co",
    "payments@mainlandevents.com",
    "+2348010000007",
    "44 Bode Thomas Street, Surulere, Lagos"
  ),
  demoCustomer(
    "Greenline Pharmacy",
    "accounts@greenlinepharmacy.com",
    "+2348010000008",
    "19 Herbert Macaulay Way, Yaba, Lagos"
  ),
  demoCustomer(
    "Coral Edge Consulting",
    "finance@coraledge.com",
    "+2348010000009",
    "2 Ligali Ayorinde Street, Victoria Island, Lagos"
  ),
  demoCustomer(
    "Swift Repairs NG",
    "billing@swiftrepairs.com",
    "+2348010000010",
    "15 Ikorodu Road, Maryland, Lagos"
  ),
  demoCustomer(
    "Archived Customer One",
    "archived.one@example.com",
    "+2348010000011",
    "1 Old Marina Road, Lagos",
    true
  ),
  demoCustomer(
    "Archived Customer Two",
    "archived.two@example.com",
    "+2348010000012",
    "2 Old Marina Road, Lagos",
    true
  )
];

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

const demoCatalogueItems = [
  {
    name: "Brand strategy workshop",
    description:
      "Full-day brand positioning workshop with stakeholder interviews and a strategy brief.",
    defaultUnitPriceKobo: 180000
  },
  {
    name: "Monthly bookkeeping support",
    description: "Monthly transaction categorisation, bank reconciliation, and management report.",
    defaultUnitPriceKobo: 220000
  },
  {
    name: "Social media campaign design",
    description: "Campaign concept, ad creatives, and copy for one product launch.",
    defaultUnitPriceKobo: 95000
  },
  {
    name: "Website maintenance retainer",
    description: "Monthly updates, backups, uptime monitoring, and small content changes.",
    defaultUnitPriceKobo: 150000
  },
  {
    name: "Business advisory session",
    description: "One-hour finance and operations advisory call with written follow-up notes.",
    defaultUnitPriceKobo: 60000
  },
  {
    name: "Staff training session",
    description: "Half-day on-site team training with materials and attendance record.",
    defaultUnitPriceKobo: 80000
  }
] as const;

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

export function assertDemoSeedAllowed(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === "production") {
    throw new Error("Demo seed is disabled in production.");
  }

  if (env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Demo seed requires ALLOW_DEMO_SEED=true in a non-production environment.");
  }
}

export async function seedDemo() {
  assertDemoSeedAllowed();
  const databaseUrl = process.env.DATABASE_URL;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run the development seed.");
  }

  if (!refreshSecret) {
    throw new Error("JWT_REFRESH_SECRET is required to hash development invitation tokens.");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const connection = drizzle(pool);
  const now = new Date();
  const passwordHash = await argon2.hash(demoPassword);

  try {
    await connection.transaction(async (tx) => {
      const db = tx;
      const receiptsService = new ReceiptsService({ db } as never, new ConfigService());

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
        const tokenHash = createHmac("sha256", refreshSecret)
          .update(invitation.token)
          .digest("hex");
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
        const archivedAt = customer.archived ? now : null;
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
                and(
                  eq(customers.organisationId, organisation.id),
                  eq(customers.name, customer.name)
                )
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

      for (const catalogueItem of demoCatalogueItems) {
        const [existingCatalogueItem] = await db
          .select()
          .from(catalogueItems)
          .where(
            and(
              eq(catalogueItems.organisationId, organisation.id),
              eq(catalogueItems.name, catalogueItem.name)
            )
          )
          .limit(1);

        if (existingCatalogueItem) {
          await db
            .update(catalogueItems)
            .set({
              description: catalogueItem.description,
              defaultUnitPriceKobo: catalogueItem.defaultUnitPriceKobo,
              archivedAt: null,
              updatedAt: now
            })
            .where(eq(catalogueItems.id, existingCatalogueItem.id));
        } else {
          await db.insert(catalogueItems).values({
            organisationId: organisation.id,
            createdByUserId: owner.id,
            name: catalogueItem.name,
            description: catalogueItem.description,
            defaultUnitPriceKobo: catalogueItem.defaultUnitPriceKobo,
            archivedAt: null
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
        .filter((customer) => !customer.archived)
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
        const dueDate =
          status === "overdue" ? invoiceDate(-15 + index) : invoiceDate(10 + index * 2);
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

        const existingLineItems = await db
          .select({ id: invoiceLineItems.id })
          .from(invoiceLineItems)
          .where(eq(invoiceLineItems.invoiceId, invoice.id));
        if (existingLineItems.length === 0) {
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
        }

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

        const existingEvents = await db
          .select({ reason: invoiceStatusEvents.reason, toStatus: invoiceStatusEvents.toStatus })
          .from(invoiceStatusEvents)
          .where(eq(invoiceStatusEvents.invoiceId, invoice.id));
        for (const event of events) {
          if (
            existingEvents.some(
              (item) => item.reason === event.reason && item.toStatus === event.toStatus
            )
          ) {
            continue;
          }
          await db.insert(invoiceStatusEvents).values({
            organisationId: organisation.id,
            invoiceId: invoice.id,
            fromStatus: event.fromStatus,
            toStatus: event.toStatus,
            reason: event.reason,
            actorUserId: owner.id,
            metadataRedacted: { invoiceNumber },
            createdAt: event.createdAt
          });
        }
      }

      const showcaseCustomer = activeCustomerByEmail.get("accounts@lagosbrightprints.com");

      if (!showcaseCustomer) {
        throw new Error("Seed showcase customer was not found for the T020 invoice.");
      }

      const showcaseInvoiceNumber = "INV-000025";
      const showcaseIssueDate = invoiceDate(-4);
      const showcaseDueDate = invoiceDate(10);
      const showcaseLines = [
        { description: "Monthly bookkeeping support", quantity: 1, unitPriceKobo: 220000 },
        { description: "Website maintenance retainer", quantity: 1, unitPriceKobo: 150000 },
        {
          description: "On-site handover and team walkthrough (ad-hoc)",
          quantity: 2,
          unitPriceKobo: 45000
        }
      ];
      const showcaseTotals = calculateSeedTotals(showcaseLines, 15000, 22500);
      const showcasePublicToken = createHmac("sha256", refreshSecret)
        .update(`invoice:${showcaseInvoiceNumber}`)
        .digest("hex");
      const showcaseSentAt = new Date(`${showcaseIssueDate}T09:00:00.000Z`);

      const [existingShowcaseInvoice] = await db
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.organisationId, organisation.id),
            eq(invoices.invoiceNumber, showcaseInvoiceNumber)
          )
        )
        .limit(1);

      const showcaseInvoiceValues = {
        organisationId: organisation.id,
        customerId: showcaseCustomer.id,
        invoiceNumber: showcaseInvoiceNumber,
        publicToken: showcasePublicToken,
        publicAccessEnabled: true,
        status: "sent" as const,
        currency: "NGN",
        issueDate: showcaseIssueDate,
        dueDate: showcaseDueDate,
        customerReference: "PO-2026-042",
        notes: "Thank you for your business. Payment due within 14 days of issue.",
        subtotalKobo: showcaseTotals.subtotalKobo,
        discountKobo: 15000,
        taxKobo: 22500,
        totalKobo: showcaseTotals.totalKobo,
        amountPaidKobo: 0,
        balanceDueKobo: showcaseTotals.balanceDueKobo,
        sentAt: showcaseSentAt,
        viewedAt: null,
        paidAt: null,
        cancelledAt: null,
        voidedAt: null,
        createdByUserId: owner.id,
        updatedAt: now
      };

      const [showcaseInvoice] = existingShowcaseInvoice
        ? await db
            .update(invoices)
            .set(showcaseInvoiceValues)
            .where(eq(invoices.id, existingShowcaseInvoice.id))
            .returning()
        : await db.insert(invoices).values(showcaseInvoiceValues).returning();

      if (!showcaseInvoice) {
        throw new Error(`Demo invoice could not be created: ${showcaseInvoiceNumber}`);
      }

      const existingShowcaseLines = await db
        .select({ id: invoiceLineItems.id })
        .from(invoiceLineItems)
        .where(eq(invoiceLineItems.invoiceId, showcaseInvoice.id));

      if (existingShowcaseLines.length === 0) {
        await db.insert(invoiceLineItems).values(
          showcaseLines.map((lineItem, itemIndex) => ({
            organisationId: organisation.id,
            invoiceId: showcaseInvoice.id,
            description: lineItem.description,
            quantity: lineItem.quantity.toFixed(2),
            unitPriceKobo: lineItem.unitPriceKobo,
            lineTotalKobo: showcaseTotals.lineTotals[itemIndex] ?? 0,
            sortOrder: itemIndex
          }))
        );
      }

      for (const showcaseEvent of [
        {
          fromStatus: null,
          toStatus: "draft" as const,
          reason: "invoice_created",
          createdAt: new Date(`${showcaseIssueDate}T08:00:00.000Z`)
        },
        {
          fromStatus: "draft" as const,
          toStatus: "sent" as const,
          reason: "invoice_sent",
          createdAt: showcaseSentAt
        }
      ]) {
        const [existingShowcaseEvent] = await db
          .select({ id: invoiceStatusEvents.id })
          .from(invoiceStatusEvents)
          .where(
            and(
              eq(invoiceStatusEvents.invoiceId, showcaseInvoice.id),
              eq(invoiceStatusEvents.reason, showcaseEvent.reason),
              eq(invoiceStatusEvents.toStatus, showcaseEvent.toStatus)
            )
          )
          .limit(1);

        if (!existingShowcaseEvent) {
          await db.insert(invoiceStatusEvents).values({
            organisationId: organisation.id,
            invoiceId: showcaseInvoice.id,
            fromStatus: showcaseEvent.fromStatus,
            toStatus: showcaseEvent.toStatus,
            reason: showcaseEvent.reason,
            actorUserId: owner.id,
            metadataRedacted: { invoiceNumber: showcaseInvoiceNumber },
            createdAt: showcaseEvent.createdAt
          });
        }
      }

      publicInvoiceUrls.push(`${frontendUrl}/invoice/${showcasePublicToken}`);

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
        const paymentValues = {
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
        } as const;
        const [existingPayment] = await db
          .select()
          .from(payments)
          .where(
            and(
              eq(payments.provider, "paystack"),
              eq(payments.providerReference, providerReference)
            )
          )
          .limit(1);
        const [payment] = existingPayment
          ? await db
              .update(payments)
              .set(paymentValues)
              .where(eq(payments.id, existingPayment.id))
              .returning()
          : await db.insert(payments).values(paymentValues).returning();

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

          const [existingPaymentEvent] = await db
            .select({ id: invoiceStatusEvents.id })
            .from(invoiceStatusEvents)
            .where(
              and(
                eq(invoiceStatusEvents.invoiceId, invoice.id),
                eq(invoiceStatusEvents.reason, "payment_webhook_reconciled"),
                eq(invoiceStatusEvents.toStatus, nextStatus)
              )
            )
            .limit(1);
          if (!existingPaymentEvent) {
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

          await receiptsService.ensureReceiptForSuccessfulPayment(db as never, payment.id);
        }

        if (
          paymentSeed.status === "successful" ||
          paymentSeed.status === "failed" ||
          paymentSeed.eventErrorMessage
        ) {
          await db
            .insert(paymentEvents)
            .values({
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
            })
            .onConflictDoNothing();
        }
      }

      await db
        .insert(paymentEvents)
        .values({
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
        })
        .onConflictDoNothing();

      await db
        .insert(invoiceNumberSequences)
        .values({ organisationId: organisation.id, nextNumber: 26, updatedAt: now })
        .onConflictDoUpdate({
          target: invoiceNumberSequences.organisationId,
          set: {
            nextNumber: sql`greatest(${invoiceNumberSequences.nextNumber}, 26)`,
            updatedAt: now
          }
        });

      await seedInvoiceDeliveryActivity();

      async function seedInvoiceDeliveryActivity(): Promise<void> {
        if (!organisation) {
          throw new Error("Demo organisation was not found for delivery seed.");
        }

        if (!owner) {
          throw new Error("Demo owner was not found for delivery seed.");
        }

        const dayMs = 24 * 60 * 60 * 1000;
        const scenarios: {
          invoiceNumber: string;
          providerMessageId: string;
          idempotencyKey: string;
          toRecipients: string[];
          ccRecipients: string[];
          subject: string;
          status: "accepted" | "delivered" | "failed" | "partially_failed";
          acceptedAt: Date;
          deliveredAt?: Date;
          failedAt?: Date;
          failureReason?: string;
          events: { eventType: string; email: string; occurredAt: Date }[];
          views: Date[];
        }[] = [
          {
            invoiceNumber: "INV-000007",
            providerMessageId: "demo-t021-000007-email-id",
            idempotencyKey: "demo-t021-000007-key",
            toRecipients: ["accounts@example.com"],
            ccRecipients: [],
            subject: "Invoice INV-000007 from Akin & Co Creative Services",
            status: "accepted",
            acceptedAt: new Date(now.getTime() - 2 * dayMs),
            events: [
              {
                eventType: "email.sent",
                email: "accounts@example.com",
                occurredAt: new Date(now.getTime() - 2 * dayMs)
              }
            ],
            views: []
          },
          {
            invoiceNumber: "INV-000008",
            providerMessageId: "demo-t021-000008-email-id",
            idempotencyKey: "demo-t021-000008-key",
            toRecipients: ["bounce@example.com"],
            ccRecipients: [],
            subject: "Invoice INV-000008 from Akin & Co Creative Services",
            status: "failed",
            acceptedAt: new Date(now.getTime() - 3 * dayMs),
            failedAt: new Date(now.getTime() - 3 * dayMs + 5 * 60 * 1000),
            failureReason: "The email address bounced. Check the recipient and try again.",
            events: [
              {
                eventType: "email.sent",
                email: "bounce@example.com",
                occurredAt: new Date(now.getTime() - 3 * dayMs)
              },
              {
                eventType: "email.bounced",
                email: "bounce@example.com",
                occurredAt: new Date(now.getTime() - 3 * dayMs + 5 * 60 * 1000)
              }
            ],
            views: []
          },
          {
            invoiceNumber: "INV-000013",
            providerMessageId: "demo-t021-000013-email-id",
            idempotencyKey: "demo-t021-000013-key",
            toRecipients: ["accounts@example.com"],
            ccRecipients: [],
            subject: "Invoice INV-000013 from Akin & Co Creative Services",
            status: "delivered",
            acceptedAt: new Date(now.getTime() - 4 * dayMs),
            deliveredAt: new Date(now.getTime() - 4 * dayMs + 2 * 60 * 1000),
            events: [
              {
                eventType: "email.sent",
                email: "accounts@example.com",
                occurredAt: new Date(now.getTime() - 4 * dayMs)
              },
              {
                eventType: "email.delivered",
                email: "accounts@example.com",
                occurredAt: new Date(now.getTime() - 4 * dayMs + 2 * 60 * 1000)
              }
            ],
            views: [
              new Date(now.getTime() - 3 * dayMs),
              new Date(now.getTime() - 3 * dayMs + 60 * 60 * 1000),
              new Date(now.getTime() - 2 * dayMs),
              new Date(now.getTime() - 1 * dayMs)
            ]
          },
          {
            invoiceNumber: "INV-000011",
            providerMessageId: "demo-t021-000011-email-id",
            idempotencyKey: "demo-t021-000011-key",
            toRecipients: ["accounts@example.com"],
            ccRecipients: [],
            subject: "Invoice INV-000011 from Akin & Co Creative Services",
            status: "delivered",
            acceptedAt: new Date(now.getTime() - 18 * dayMs),
            deliveredAt: new Date(now.getTime() - 18 * dayMs + 3 * 60 * 1000),
            events: [
              {
                eventType: "email.sent",
                email: "accounts@example.com",
                occurredAt: new Date(now.getTime() - 18 * dayMs)
              },
              {
                eventType: "email.delivered",
                email: "accounts@example.com",
                occurredAt: new Date(now.getTime() - 18 * dayMs + 3 * 60 * 1000)
              }
            ],
            views: [new Date(now.getTime() - 17 * dayMs), new Date(now.getTime() - 16 * dayMs)]
          },
          {
            invoiceNumber: "INV-000025",
            providerMessageId: "demo-t021-000025-email-id",
            idempotencyKey: "demo-t021-000025-key",
            toRecipients: ["accounts@example.com"],
            ccRecipients: ["bounce@example.com"],
            subject: "Invoice INV-000025 from Akin & Co Creative Services",
            status: "partially_failed",
            acceptedAt: new Date(now.getTime() - 1 * dayMs),
            failedAt: new Date(now.getTime() - 1 * dayMs + 10 * 60 * 1000),
            failureReason:
              "1 of 2 recipients failed delivery. See the activity timeline for the affected addresses.",
            events: [
              {
                eventType: "email.sent",
                email: "accounts@example.com",
                occurredAt: new Date(now.getTime() - 1 * dayMs)
              },
              {
                eventType: "email.delivered",
                email: "accounts@example.com",
                occurredAt: new Date(now.getTime() - 1 * dayMs + 2 * 60 * 1000)
              },
              {
                eventType: "email.bounced",
                email: "bounce@example.com",
                occurredAt: new Date(now.getTime() - 1 * dayMs + 10 * 60 * 1000)
              }
            ],
            views: []
          }
        ];

        for (const scenario of scenarios) {
          const invoice = invoiceByNumber.get(scenario.invoiceNumber);

          if (!invoice) {
            continue;
          }

          // Rebuild demo delivery fixtures so reruns converge on the current
          // recipient-aware shape instead of accumulating legacy rows.
          const [seedExisting] = await db
            .select({ id: communications.id })
            .from(communications)
            .where(eq(communications.providerMessageId, scenario.providerMessageId))
            .limit(1);

          if (seedExisting) {
            await db
              .delete(communicationEvents)
              .where(eq(communicationEvents.communicationId, seedExisting.id));
            await db
              .delete(communicationRecipients)
              .where(eq(communicationRecipients.communicationId, seedExisting.id));
            await db.delete(communications).where(eq(communications.id, seedExisting.id));
          }

          const [created] = await db
            .insert(communications)
            .values({
              organisationId: organisation.id,
              invoiceId: invoice.id,
              customerId: invoice.customerId,
              purpose: "invoice_delivery",
              channel: "email",
              provider: "resend",
              subject: scenario.subject,
              toRecipients: scenario.toRecipients,
              ccRecipients: scenario.ccRecipients,
              providerMessageId: scenario.providerMessageId,
              providerIdempotencyKey: scenario.idempotencyKey,
              status: scenario.status,
              acceptedAt: scenario.acceptedAt,
              deliveredAt: scenario.deliveredAt ?? null,
              deferredAt: null,
              failedAt: scenario.failedAt ?? null,
              failureReason: scenario.failureReason ?? null,
              createdByUserId: owner.id,
              createdAt: scenario.acceptedAt,
              updatedAt: now
            })
            .returning({ id: communications.id });

          const communicationId = created?.id;

          if (!communicationId) {
            continue;
          }

          const recipientOutcomes = new Map<
            string,
            { status: "accepted" | "delivered" | "failed"; at: Date; failureReason: string | null }
          >();

          for (const event of scenario.events) {
            if (event.eventType === "email.sent") {
              continue;
            }

            recipientOutcomes.set(event.email, {
              status: event.eventType === "email.delivered" ? "delivered" : "failed",
              at: event.occurredAt,
              failureReason:
                event.eventType === "email.delivered" ? null : (scenario.failureReason ?? null)
            });
          }

          for (const { email, recipientType } of [
            ...scenario.toRecipients.map((email) => ({ email, recipientType: "to" as const })),
            ...scenario.ccRecipients.map((email) => ({ email, recipientType: "cc" as const }))
          ]) {
            const outcome = recipientOutcomes.get(email) ?? {
              status: "accepted" as const,
              at: scenario.acceptedAt,
              failureReason: null
            };

            await db.insert(communicationRecipients).values({
              organisationId: organisation.id,
              communicationId,
              invoiceId: invoice.id,
              email,
              recipientType,
              status: outcome.status,
              acceptedAt: scenario.acceptedAt,
              deliveredAt: outcome.status === "delivered" ? outcome.at : null,
              deferredAt: null,
              failedAt: outcome.status === "failed" ? outcome.at : null,
              failureReason: outcome.failureReason,
              createdAt: scenario.acceptedAt,
              updatedAt: now
            });
          }

          for (const event of scenario.events) {
            await db
              .insert(communicationEvents)
              .values({
                organisationId: organisation.id,
                communicationId,
                invoiceId: invoice.id,
                provider: "resend",
                providerEventKey: `resend:${scenario.providerMessageId}:${event.eventType}:${Math.floor(event.occurredAt.getTime() / 1000)}:${event.email}`,
                eventType: event.eventType,
                occurredAt: event.occurredAt,
                metadataRedacted: { seed: "demo_communication_event", email: event.email },
                createdAt: event.occurredAt
              })
              .onConflictDoNothing();
          }

          const existingViews = await db
            .select({ id: invoiceViewEvents.id })
            .from(invoiceViewEvents)
            .where(eq(invoiceViewEvents.invoiceId, invoice.id))
            .limit(1);

          if (existingViews.length === 0 && scenario.views.length > 0) {
            for (const occurredAt of scenario.views) {
              await db.insert(invoiceViewEvents).values({
                organisationId: organisation.id,
                invoiceId: invoice.id,
                occurredAt,
                source: "public_invoice_page",
                createdAt: occurredAt
              });
            }

            const sortedViews = [...scenario.views].sort((a, b) => a.getTime() - b.getTime());

            await db
              .update(invoices)
              .set({
                viewedAt: sortedViews[0] ?? null,
                lastViewedAt: sortedViews[sortedViews.length - 1] ?? null,
                viewCount: sortedViews.length,
                updatedAt: now
              })
              .where(eq(invoices.id, invoice.id));
          }
        }
      }

      // T022 automation demo data (idempotent, no real email).
      const demoCustomerRows = await db.select().from(customers).where(eq(customers.organisationId, organisation.id)).limit(5);
      const seedCustomer = demoCustomerRows[0];
      if (seedCustomer) {
        const seedSchedules: Array<{ name: string; status: "active" | "paused" | "completed"; frequency: "monthly" | "quarterly"; anchorDay: number; anchorMonth: number; startDate: string; nextIssueDate: string; endDate?: string }> = [
          { name: "Monthly retainer (demo)", status: "active", frequency: "monthly", anchorDay: 15, anchorMonth: 9, startDate: "2026-09-15", nextIssueDate: "2026-10-15" },
          { name: "Paused retainer (demo)", status: "paused", frequency: "monthly", anchorDay: 1, anchorMonth: 9, startDate: "2026-09-01", nextIssueDate: "2026-09-01" },
          { name: "Completed retainer (demo)", status: "completed", frequency: "quarterly", anchorDay: 1, anchorMonth: 1, startDate: "2026-01-01", nextIssueDate: "2026-10-01", endDate: "2026-07-01" }
        ];
        for (const s of seedSchedules) {
          const [existing] = await db.select({ id: recurringInvoiceSchedules.id }).from(recurringInvoiceSchedules).where(and(eq(recurringInvoiceSchedules.organisationId, organisation.id), eq(recurringInvoiceSchedules.name, s.name))).limit(1);
          if (!existing) {
            await db.insert(recurringInvoiceSchedules).values({
              organisationId: organisation.id, customerId: seedCustomer.id, name: s.name,
              status: s.status, frequency: s.frequency, anchorDay: s.anchorDay, anchorMonth: s.anchorMonth,
              startDate: s.startDate, nextIssueDate: s.nextIssueDate, endDate: s.endDate ?? null, dueTermsDays: 14,
              autoSend: false, toRecipients: [seedCustomer.email], ccRecipients: [],
              discountKobo: 0, taxKobo: 0, createdByUserId: owner.id
            });
          }
        }
        const schedRows = await db.select().from(recurringInvoiceSchedules).where(eq(recurringInvoiceSchedules.organisationId, organisation.id));
        const activeSched = schedRows.find((s) => s.name === "Monthly retainer (demo)");
        if (activeSched) {
          const existingItems = await db.select().from(recurringInvoiceScheduleLineItems).where(eq(recurringInvoiceScheduleLineItems.scheduleId, activeSched.id)).limit(1);
          if (existingItems.length === 0) {
            await db.insert(recurringInvoiceScheduleLineItems).values({
              organisationId: organisation.id, scheduleId: activeSched.id,
              description: "Monthly retainer", quantity: "1", unitPriceKobo: 78400, sortOrder: 0
            });
          }
          await db.insert(recurringInvoiceOccurrences).values({
            organisationId: organisation.id, scheduleId: activeSched.id,
            scheduledFor: "2026-09-15", status: "generated"
          }).onConflictDoNothing();
        }
        if (demoCustomerRows[1]) {
          await db.update(customers).set({ automaticRemindersEnabled: false }).where(eq(customers.id, demoCustomerRows[1].id));
        }
        await db.insert(organisationReminderSettings).values({ organisationId: organisation.id, enabled: true, updatedByUserId: owner.id }).onConflictDoUpdate({ target: organisationReminderSettings.organisationId, set: { enabled: true, updatedByUserId: owner.id } });
        await db.insert(reminderSteps).values([
          { organisationId: organisation.id, relativeDays: -3, subjectTemplate: "Invoice {{invoiceNumber}} is due soon", bodyTemplate: "Hello {{customerName}}, invoice {{invoiceNumber}} for {{amountDue}} is due on {{dueDate}}. Pay here: {{publicInvoiceUrl}} Thank you, {{businessName}}", enabled: true, sortOrder: 0 },
          { organisationId: organisation.id, relativeDays: 1, subjectTemplate: "Invoice {{invoiceNumber}} is overdue", bodyTemplate: "Hello {{customerName}}, invoice {{invoiceNumber}} for {{amountDue}} was due on {{dueDate}}. Pay here: {{publicInvoiceUrl}} Thank you, {{businessName}}", enabled: true, sortOrder: 1 },
          { organisationId: organisation.id, relativeDays: 7, subjectTemplate: "Reminder: {{amountDue}} is still outstanding", bodyTemplate: "Hello {{customerName}}, invoice {{invoiceNumber}} for {{amountDue}} is still unpaid. Pay here: {{publicInvoiceUrl}} Thank you, {{businessName}}", enabled: true, sortOrder: 2 }
        ]).onConflictDoNothing();
        const demoInvoices = await db.select().from(invoices).where(eq(invoices.organisationId, organisation.id)).limit(5);
        if (demoInvoices[0]) {
          await db.update(invoices).set({ automaticRemindersEnabled: false }).where(eq(invoices.id, demoInvoices[0].id));
        }
        if (demoInvoices[1]) {
          await db.update(invoices).set({ scheduledSendDate: "2026-10-07", scheduledSendTo: [seedCustomer.email] }).where(eq(invoices.id, demoInvoices[1].id));
          await db.insert(automationJobs).values({
            organisationId: organisation.id, kind: "invoice_scheduled_send", resourceType: "invoice",
            resourceId: demoInvoices[1].id, scheduledFor: "2026-10-07",
            idempotencyKey: `seed-scheduled:${demoInvoices[1].id}:2026-10-07`, status: "pending", maxAttempts: 3
          }).onConflictDoNothing();
        }
        if (demoInvoices[2]) {
          await db.insert(automationJobs).values({
            organisationId: organisation.id, kind: "invoice_reminder_send", resourceType: "invoice",
            resourceId: demoInvoices[2].id, scheduledFor: "2026-10-01",
            idempotencyKey: `seed-reminder-done:${demoInvoices[2].id}`, status: "completed",
            maxAttempts: 3, completedAt: now,
            payloadRedacted: { invoiceId: demoInvoices[2].id, relativeDays: 1 }
          }).onConflictDoNothing();
        }
        if (demoInvoices[3]) {
          await db.insert(automationJobs).values({
            organisationId: organisation.id, kind: "recurring_invoice_generate", resourceType: "recurring_schedule",
            resourceId: activeSched ? activeSched.id : demoInvoices[3].id, scheduledFor: "2026-10-01",
            idempotencyKey: `seed-needs-attention:${demoInvoices[3].id}`, status: "needs_attention",
            maxAttempts: 3, lastError: "Email delivery is not configured in seed."
          }).onConflictDoNothing();
        }
      }
      console.log("Development seed complete.");
      console.log(`Demo organisation: ${organisationName}`);
      console.log("Demo password for all seeded users: DemoPass123!");
      console.log(`Seeded demo customers: ${demoCustomers.length}`);
      console.log(`Seeded demo catalogue items: ${demoCatalogueItems.length}`);
      console.log(`Seeded demo invoices: ${invoiceStatuses.length + 1}`);
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
    });
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  void seedDemo().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

