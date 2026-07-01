import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  index,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export const organisationRoleEnum = pgEnum("organisation_role", [
  "owner",
  "admin",
  "accountant",
  "viewer"
]);

export const organisationMemberStatusEnum = pgEnum("organisation_member_status", [
  "active",
  "suspended",
  "removed"
]);

export const organisationInvitationStatusEnum = pgEnum("organisation_invitation_status", [
  "pending",
  "accepted",
  "revoked",
  "expired"
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "viewed",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
  "void"
]);

export const organisationPaymentAccountStatusEnum = pgEnum("organisation_payment_account_status", [
  "pending_confirmation",
  "active",
  "verification_delayed",
  "disabled"
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  ...timestamps
});

export const organisations = pgTable("organisations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 220 }).notNull().unique(),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  ...timestamps
});

export const organisationMembers = pgTable(
  "organisation_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: organisationRoleEnum("role").notNull(),
    status: organisationMemberStatusEnum("status").notNull().default("active"),
    ...timestamps
  },
  (table) => ({
    organisationUserUnique: uniqueIndex("organisation_members_org_user_unique").on(
      table.organisationId,
      table.userId
    )
  })
);

export const organisationInvitations = pgTable(
  "organisation_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    role: organisationRoleEnum("role").notNull(),
    status: organisationInvitationStatusEnum("status").notNull().default("pending"),
    invitedByUserId: uuid("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    pendingInvitationEmailUnique: uniqueIndex("organisation_invitations_pending_email_unique")
      .on(table.organisationId, sql`lower(${table.email})`)
      .where(sql`${table.status} = 'pending'`)
  })
);

export const businessProfiles = pgTable("business_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id")
    .notNull()
    .unique()
    .references(() => organisations.id, { onDelete: "cascade" }),
  businessName: varchar("business_name", { length: 200 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  logoFileId: uuid("logo_file_id"),
  setupCompletedAt: timestamp("setup_completed_at", { withTimezone: true }),
  ...timestamps
});

export const organisationPaymentAccounts = pgTable(
  "organisation_payment_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 40 }).notNull().default("paystack"),
    providerSubaccountCode: varchar("provider_subaccount_code", { length: 120 }),
    bankCode: varchar("bank_code", { length: 40 }).notNull(),
    bankName: varchar("bank_name", { length: 200 }).notNull(),
    accountName: varchar("account_name", { length: 200 }).notNull(),
    accountNumberLast4: varchar("account_number_last4", { length: 4 }).notNull(),
    status: organisationPaymentAccountStatusEnum("status").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    providerMetadataRedacted: jsonb("provider_metadata_redacted").$type<Record<string, unknown>>(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    ...timestamps
  },
  (table) => ({
    organisationIndex: index("organisation_payment_accounts_organisation_id_idx").on(
      table.organisationId
    ),
    organisationProviderIndex: index("organisation_payment_accounts_org_provider_idx").on(
      table.organisationId,
      table.provider
    ),
    organisationStatusIndex: index("organisation_payment_accounts_org_status_idx").on(
      table.organisationId,
      table.status
    ),
    providerSubaccountCodeUnique: uniqueIndex(
      "organisation_payment_accounts_subaccount_code_unique"
    )
      .on(table.providerSubaccountCode)
      .where(sql`${table.providerSubaccountCode} is not null`),
    activeAccountUnique: uniqueIndex("organisation_payment_accounts_active_unique")
      .on(table.organisationId, table.provider)
      .where(sql`${table.status} = 'active'`)
  })
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    phone: varchar("phone", { length: 50 }),
    billingAddress: text("billing_address"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    organisationIndex: index("customers_organisation_id_idx").on(table.organisationId),
    organisationArchivedIndex: index("customers_org_archived_at_idx").on(
      table.organisationId,
      table.archivedAt
    ),
    organisationEmailIndex: index("customers_org_email_idx").on(table.organisationId, table.email),
    organisationNameIndex: index("customers_org_name_idx").on(table.organisationId, table.name),
    activeEmailUnique: uniqueIndex("customers_active_email_unique")
      .on(table.organisationId, sql`lower(${table.email})`)
      .where(sql`${table.archivedAt} is null`)
  })
);

export const invoiceNumberSequences = pgTable(
  "invoice_number_sequences",
  {
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    nextNumber: integer("next_number").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.organisationId] })
  })
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    invoiceNumber: varchar("invoice_number", { length: 40 }).notNull(),
    publicToken: text("public_token").notNull().unique(),
    publicAccessEnabled: boolean("public_access_enabled").notNull().default(false),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date").notNull(),
    notes: text("notes"),
    subtotalKobo: integer("subtotal_kobo").notNull().default(0),
    discountKobo: integer("discount_kobo").notNull().default(0),
    taxKobo: integer("tax_kobo").notNull().default(0),
    totalKobo: integer("total_kobo").notNull().default(0),
    amountPaidKobo: integer("amount_paid_kobo").notNull().default(0),
    balanceDueKobo: integer("balance_due_kobo").notNull().default(0),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    ...timestamps
  },
  (table) => ({
    organisationInvoiceNumberUnique: uniqueIndex("invoices_org_invoice_number_unique").on(
      table.organisationId,
      table.invoiceNumber
    ),
    organisationIndex: index("invoices_organisation_id_idx").on(table.organisationId),
    organisationStatusIndex: index("invoices_org_status_idx").on(
      table.organisationId,
      table.status
    ),
    organisationCustomerIndex: index("invoices_org_customer_id_idx").on(
      table.organisationId,
      table.customerId
    ),
    organisationDueDateIndex: index("invoices_org_due_date_idx").on(
      table.organisationId,
      table.dueDate
    ),
    organisationCreatedAtIndex: index("invoices_org_created_at_idx").on(
      table.organisationId,
      table.createdAt
    )
  })
);

export const invoiceLineItems = pgTable(
  "invoice_line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
    unitPriceKobo: integer("unit_price_kobo").notNull(),
    lineTotalKobo: integer("line_total_kobo").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps
  },
  (table) => ({
    organisationInvoiceIndex: index("invoice_line_items_org_invoice_id_idx").on(
      table.organisationId,
      table.invoiceId
    )
  })
);

export const invoiceStatusEvents = pgTable(
  "invoice_status_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    fromStatus: invoiceStatusEnum("from_status"),
    toStatus: invoiceStatusEnum("to_status").notNull(),
    reason: text("reason"),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    metadataRedacted: jsonb("metadata_redacted").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    organisationInvoiceIndex: index("invoice_status_events_org_invoice_id_idx").on(
      table.organisationId,
      table.invoiceId
    )
  })
);

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  ...timestamps
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").references(() => organisations.id, {
    onDelete: "set null"
  }),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entity_type", { length: 120 }).notNull(),
  entityId: uuid("entity_id"),
  metadataRedacted: jsonb("metadata_redacted").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(organisationMembers),
  sentInvitations: many(organisationInvitations),
  refreshTokens: many(refreshTokens)
}));

export const organisationsRelations = relations(organisations, ({ many, one }) => ({
  members: many(organisationMembers),
  invitations: many(organisationInvitations),
  paymentAccounts: many(organisationPaymentAccounts),
  customers: many(customers),
  invoices: many(invoices),
  invoiceNumberSequence: one(invoiceNumberSequences),
  businessProfile: one(businessProfiles),
  auditLogs: many(auditLogs)
}));

export const organisationMembersRelations = relations(organisationMembers, ({ one }) => ({
  organisation: one(organisations, {
    fields: [organisationMembers.organisationId],
    references: [organisations.id]
  }),
  user: one(users, {
    fields: [organisationMembers.userId],
    references: [users.id]
  })
}));

export const organisationInvitationsRelations = relations(organisationInvitations, ({ one }) => ({
  organisation: one(organisations, {
    fields: [organisationInvitations.organisationId],
    references: [organisations.id]
  }),
  invitedBy: one(users, {
    fields: [organisationInvitations.invitedByUserId],
    references: [users.id]
  })
}));

export const businessProfilesRelations = relations(businessProfiles, ({ one }) => ({
  organisation: one(organisations, {
    fields: [businessProfiles.organisationId],
    references: [organisations.id]
  })
}));

export const organisationPaymentAccountsRelations = relations(
  organisationPaymentAccounts,
  ({ one }) => ({
    organisation: one(organisations, {
      fields: [organisationPaymentAccounts.organisationId],
      references: [organisations.id]
    }),
    createdBy: one(users, {
      fields: [organisationPaymentAccounts.createdByUserId],
      references: [users.id]
    })
  })
);

export const customersRelations = relations(customers, ({ one }) => ({
  organisation: one(organisations, {
    fields: [customers.organisationId],
    references: [organisations.id]
  }),
  createdBy: one(users, {
    fields: [customers.createdByUserId],
    references: [users.id]
  })
}));

export const invoiceNumberSequencesRelations = relations(invoiceNumberSequences, ({ one }) => ({
  organisation: one(organisations, {
    fields: [invoiceNumberSequences.organisationId],
    references: [organisations.id]
  })
}));

export const invoicesRelations = relations(invoices, ({ many, one }) => ({
  organisation: one(organisations, {
    fields: [invoices.organisationId],
    references: [organisations.id]
  }),
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id]
  }),
  createdBy: one(users, {
    fields: [invoices.createdByUserId],
    references: [users.id]
  }),
  lineItems: many(invoiceLineItems),
  statusEvents: many(invoiceStatusEvents)
}));

export const invoiceLineItemsRelations = relations(invoiceLineItems, ({ one }) => ({
  organisation: one(organisations, {
    fields: [invoiceLineItems.organisationId],
    references: [organisations.id]
  }),
  invoice: one(invoices, {
    fields: [invoiceLineItems.invoiceId],
    references: [invoices.id]
  })
}));

export const invoiceStatusEventsRelations = relations(invoiceStatusEvents, ({ one }) => ({
  organisation: one(organisations, {
    fields: [invoiceStatusEvents.organisationId],
    references: [organisations.id]
  }),
  invoice: one(invoices, {
    fields: [invoiceStatusEvents.invoiceId],
    references: [invoices.id]
  }),
  actor: one(users, {
    fields: [invoiceStatusEvents.actorUserId],
    references: [users.id]
  })
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id]
  })
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organisation: one(organisations, {
    fields: [auditLogs.organisationId],
    references: [organisations.id]
  }),
  actor: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id]
  })
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Organisation = typeof organisations.$inferSelect;
export type OrganisationMember = typeof organisationMembers.$inferSelect;
export type OrganisationInvitation = typeof organisationInvitations.$inferSelect;
export type BusinessProfile = typeof businessProfiles.$inferSelect;
export type OrganisationPaymentAccount = typeof organisationPaymentAccounts.$inferSelect;
export type NewOrganisationPaymentAccount = typeof organisationPaymentAccounts.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type InvoiceStatusEvent = typeof invoiceStatusEvents.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
