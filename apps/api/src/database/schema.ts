import { relations, sql } from "drizzle-orm";
import {
  jsonb,
  index,
  pgEnum,
  pgTable,
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
  customers: many(customers),
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
export type Customer = typeof customers.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
