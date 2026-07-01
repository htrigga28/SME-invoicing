import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { DatabaseService } from "../../database/database.service";
import {
  auditLogs,
  organisationPaymentAccounts,
  type NewOrganisationPaymentAccount,
  type OrganisationPaymentAccount
} from "../../database/schema";

type AuditLogInput = {
  action: string;
  actorUserId?: string | null;
  entityId?: string | null;
  entityType: string;
  metadataRedacted?: Record<string, unknown> | null;
  organisationId?: string | null;
};

@Injectable()
export class PaymentSetupRepository {
  constructor(@Inject(DatabaseService) private readonly databaseService: DatabaseService) {}

  async findCurrentAccount(organisationId: string): Promise<OrganisationPaymentAccount | null> {
    const [account] = await this.databaseService.db
      .select()
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

  async findManageableAccount(organisationId: string): Promise<OrganisationPaymentAccount | null> {
    const [account] = await this.databaseService.db
      .select()
      .from(organisationPaymentAccounts)
      .where(
        and(
          eq(organisationPaymentAccounts.organisationId, organisationId),
          eq(organisationPaymentAccounts.provider, "paystack"),
          inArray(organisationPaymentAccounts.status, ["active", "verification_delayed"])
        )
      )
      .orderBy(desc(organisationPaymentAccounts.updatedAt))
      .limit(1);

    return account ?? null;
  }

  async createPaymentAccount(input: {
    account: NewOrganisationPaymentAccount;
    auditLogs: AuditLogInput[];
    now: Date;
    organisationId: string;
  }): Promise<OrganisationPaymentAccount> {
    return this.databaseService.db.transaction(async (tx) => {
      await tx
        .update(organisationPaymentAccounts)
        .set({
          disabledAt: input.now,
          status: "disabled",
          updatedAt: input.now
        })
        .where(
          and(
            eq(organisationPaymentAccounts.organisationId, input.organisationId),
            eq(organisationPaymentAccounts.provider, "paystack"),
            eq(organisationPaymentAccounts.status, "active")
          )
        );

      const [account] = await tx
        .insert(organisationPaymentAccounts)
        .values(input.account)
        .returning();

      if (!account) {
        throw new Error("Payment account creation failed.");
      }

      await tx.insert(auditLogs).values(
        input.auditLogs.map((auditLog) => ({
          ...auditLog,
          entityId: auditLog.entityId ?? account.id
        }))
      );

      return account;
    });
  }

  async disablePaymentAccount(input: {
    accountId: string;
    actorUserId: string;
    metadataRedacted: Record<string, unknown>;
    now: Date;
    organisationId: string;
  }): Promise<OrganisationPaymentAccount> {
    return this.databaseService.db.transaction(async (tx) => {
      const [account] = await tx
        .update(organisationPaymentAccounts)
        .set({
          disabledAt: input.now,
          status: "disabled",
          updatedAt: input.now
        })
        .where(
          and(
            eq(organisationPaymentAccounts.organisationId, input.organisationId),
            eq(organisationPaymentAccounts.id, input.accountId),
            inArray(organisationPaymentAccounts.status, ["active", "verification_delayed"])
          )
        )
        .returning();

      if (!account) {
        throw new Error("Payment account disable failed.");
      }

      await tx.insert(auditLogs).values({
        organisationId: input.organisationId,
        actorUserId: input.actorUserId,
        action: "payment_account_disabled",
        entityType: "organisation_payment_account",
        entityId: account.id,
        metadataRedacted: input.metadataRedacted
      });

      return account;
    });
  }

  async createAuditLog(input: AuditLogInput): Promise<void> {
    await this.databaseService.db.insert(auditLogs).values(input);
  }
}
