import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";

import type { ActiveOrganisationContext } from "../../common/types/request-context";
import { DatabaseService, type AppDatabase } from "../../database/database.service";
import {
  auditLogs,
  automationJobs,
  customers,
  invoices,
  organisationReminderSettings,
  reminderSteps
} from "../../database/schema";
import { AuditLogService } from "../audit-log/audit-log.service";
import { assertValidReminderTemplate } from "./reminder-template";
import type { ReminderStepDto, UpsertReminderSettingsDto } from "./dto/reminder-settings.dto";

const SUGGESTED_STEPS: ReminderStepDto[] = [
  {
    relativeDays: -3,
    subjectTemplate: "Invoice {{invoiceNumber}} is due soon",
    bodyTemplate:
      "Hello {{customerName}},\n\nThis is a friendly reminder that invoice {{invoiceNumber}} for {{amountDue}} is due on {{dueDate}}.\n\nYou can view and pay here: {{publicInvoiceUrl}}\n\nThank you,\n{{businessName}}"
  },
  {
    relativeDays: 1,
    subjectTemplate: "Invoice {{invoiceNumber}} is overdue",
    bodyTemplate:
      "Hello {{customerName}},\n\nInvoice {{invoiceNumber}} for {{amountDue}} was due on {{dueDate}} and is now overdue.\n\nPay here: {{publicInvoiceUrl}}\n\nThank you,\n{{businessName}}"
  },
  {
    relativeDays: 7,
    subjectTemplate: "Reminder: {{amountDue}} is still outstanding",
    bodyTemplate:
      "Hello {{customerName}},\n\nInvoice {{invoiceNumber}} for {{amountDue}} is still unpaid. It was due on {{dueDate}}.\n\nPay here: {{publicInvoiceUrl}}\n\nThank you,\n{{businessName}}"
  }
];

type Transaction = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

function validateSteps(steps: ReminderStepDto[]) {
  const seen = new Set<number>();
  for (const step of steps) {
    if (!Number.isInteger(step.relativeDays) || step.relativeDays < -30 || step.relativeDays > 60) {
      throw new BadRequestException("Reminder timing must be between -30 and +60 days.");
    }
    if (seen.has(step.relativeDays)) {
      throw new BadRequestException("Only one active step is allowed per relative day.");
    }
    seen.add(step.relativeDays);
    if (!step.subjectTemplate?.trim() || !step.bodyTemplate?.trim()) {
      throw new BadRequestException("Reminder subject and message are required.");
    }
    assertValidReminderTemplate(step.subjectTemplate, "Subject");
    assertValidReminderTemplate(step.bodyTemplate, "Message");
  }
}

@Injectable()
export class ReminderSettingsService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService
  ) {}

  private async lockReminderJobs(tx: Transaction, orgId: string, scope?: SQL) {
    const jobs = await tx
      .select({ id: automationJobs.id, status: automationJobs.status })
      .from(automationJobs)
      .where(
        and(
          eq(automationJobs.organisationId, orgId),
          eq(automationJobs.kind, "invoice_reminder_send"),
          inArray(automationJobs.status, ["pending", "running", "sending"]),
          scope
        )
      )
      .orderBy(automationJobs.id)
      .for("update");
    if (jobs.some((job) => job.status === "sending")) {
      throw new ConflictException("A reminder email is already being sent.");
    }
    if (jobs.length) {
      await tx
        .update(automationJobs)
        .set({
          status: "cancelled",
          claimToken: null,
          claimedAt: null,
          skippedAt: new Date(),
          updatedAt: new Date()
        })
        .where(
          inArray(
            automationJobs.id,
            jobs.map((job) => job.id)
          )
        );
    }
  }

  private async lockSettings(tx: Transaction, orgId: string) {
    await tx
      .select()
      .from(organisationReminderSettings)
      .where(eq(organisationReminderSettings.organisationId, orgId))
      .for("update");
  }

  async getSettings(organisationId: string) {
    const [settings] = await this.databaseService.db
      .select()
      .from(organisationReminderSettings)
      .where(eq(organisationReminderSettings.organisationId, organisationId))
      .limit(1);
    const steps = await this.databaseService.db
      .select()
      .from(reminderSteps)
      .where(eq(reminderSteps.organisationId, organisationId))
      .orderBy(asc(reminderSteps.relativeDays));
    return {
      enabled: settings?.enabled ?? false,
      steps,
      suggestedSteps: SUGGESTED_STEPS
    };
  }

  async putSettings(context: ActiveOrganisationContext, dto: UpsertReminderSettingsDto) {
    const orgId = context.activeOrganisation.id;
    const steps = dto.steps ?? SUGGESTED_STEPS;
    validateSteps(steps);
    if (dto.enabled && steps.filter((step) => step.enabled ?? true).length === 0) {
      throw new BadRequestException(
        "Enable at least one reminder step before turning on reminders."
      );
    }
    await this.databaseService.db.transaction(async (tx) => {
      await this.lockReminderJobs(tx, orgId);
      await tx
        .insert(organisationReminderSettings)
        .values({ organisationId: orgId, enabled: dto.enabled, updatedByUserId: context.user.id })
        .onConflictDoUpdate({
          target: organisationReminderSettings.organisationId,
          set: { enabled: dto.enabled, updatedByUserId: context.user.id, updatedAt: new Date() }
        });
      await tx.delete(reminderSteps).where(eq(reminderSteps.organisationId, orgId));
      if (steps.length > 0) {
        await tx.insert(reminderSteps).values(
          steps.map((step, index) => ({
            organisationId: orgId,
            relativeDays: step.relativeDays,
            subjectTemplate: step.subjectTemplate.trim(),
            bodyTemplate: step.bodyTemplate.trim(),
            enabled: step.enabled ?? true,
            sortOrder: index
          }))
        );
      }
      await tx.insert(auditLogs).values({
        organisationId: orgId,
        actorUserId: context.user.id,
        action: dto.enabled ? "reminder_settings_enabled" : "reminder_settings_disabled",
        entityType: "organisation",
        entityId: orgId,
        metadataRedacted: { stepCount: steps.length }
      });
    });
    return this.getSettings(orgId);
  }

  async createStep(context: ActiveOrganisationContext, dto: ReminderStepDto) {
    const orgId = context.activeOrganisation.id;
    validateSteps([dto]);
    return this.databaseService.db.transaction(async (tx) => {
      await tx
        .insert(organisationReminderSettings)
        .values({ organisationId: orgId, enabled: false, updatedByUserId: context.user.id })
        .onConflictDoNothing();
      await this.lockSettings(tx, orgId);
      const [existing] = await tx
        .select()
        .from(reminderSteps)
        .where(
          and(
            eq(reminderSteps.organisationId, orgId),
            eq(reminderSteps.relativeDays, dto.relativeDays)
          )
        )
        .limit(1);
      if (existing) throw new BadRequestException("A step already exists for this timing.");
      const [created] = await tx
        .insert(reminderSteps)
        .values({
          organisationId: orgId,
          relativeDays: dto.relativeDays,
          subjectTemplate: dto.subjectTemplate.trim(),
          bodyTemplate: dto.bodyTemplate.trim(),
          enabled: dto.enabled ?? true
        })
        .returning();
      await tx.insert(auditLogs).values({
        organisationId: orgId,
        actorUserId: context.user.id,
        action: "reminder_step_added",
        entityType: "reminder_step",
        entityId: created!.id,
        metadataRedacted: { relativeDays: dto.relativeDays }
      });
      return created!;
    });
  }

  async updateStep(
    context: ActiveOrganisationContext,
    stepId: string,
    dto: Partial<ReminderStepDto>
  ) {
    const orgId = context.activeOrganisation.id;
    const [existing] = await this.databaseService.db
      .select()
      .from(reminderSteps)
      .where(and(eq(reminderSteps.id, stepId), eq(reminderSteps.organisationId, orgId)))
      .limit(1);
    if (!existing) throw new NotFoundException("Reminder step was not found.");
    const next = {
      relativeDays: dto.relativeDays ?? existing.relativeDays,
      subjectTemplate: (dto.subjectTemplate ?? existing.subjectTemplate).trim(),
      bodyTemplate: (dto.bodyTemplate ?? existing.bodyTemplate).trim(),
      enabled: dto.enabled ?? existing.enabled
    };
    validateSteps([next as ReminderStepDto]);
    if (next.relativeDays !== existing.relativeDays) {
      const [clash] = await this.databaseService.db
        .select()
        .from(reminderSteps)
        .where(
          and(
            eq(reminderSteps.organisationId, orgId),
            eq(reminderSteps.relativeDays, next.relativeDays)
          )
        )
        .limit(1);
      if (clash) throw new BadRequestException("A step already exists for this timing.");
    }
    const [updated] = await this.databaseService.db.transaction(async (tx) => {
      await this.lockReminderJobs(
        tx,
        orgId,
        sql`${automationJobs.payloadRedacted}->>'stepId' = ${stepId}`
      );
      await this.lockSettings(tx, orgId);
      const [locked] = await tx
        .select()
        .from(reminderSteps)
        .where(and(eq(reminderSteps.id, stepId), eq(reminderSteps.organisationId, orgId)))
        .for("update");
      if (!locked || locked.updatedAt.getTime() !== existing.updatedAt.getTime()) {
        throw new ConflictException("Reminder step changed. Reload and try again.");
      }
      const rows = await tx
        .update(reminderSteps)
        .set({ ...next, updatedAt: new Date() })
        .where(and(eq(reminderSteps.id, stepId), eq(reminderSteps.organisationId, orgId)))
        .returning();
      await tx.insert(auditLogs).values({
        organisationId: orgId,
        actorUserId: context.user.id,
        action: "reminder_step_edited",
        entityType: "reminder_step",
        entityId: stepId,
        metadataRedacted: { relativeDays: next.relativeDays }
      });
      return rows;
    });
    return updated;
  }

  async deleteStep(context: ActiveOrganisationContext, stepId: string) {
    const orgId = context.activeOrganisation.id;
    const [existing] = await this.databaseService.db
      .select()
      .from(reminderSteps)
      .where(and(eq(reminderSteps.id, stepId), eq(reminderSteps.organisationId, orgId)))
      .limit(1);
    if (!existing) throw new NotFoundException("Reminder step was not found.");
    await this.databaseService.db.transaction(async (tx) => {
      await this.lockReminderJobs(
        tx,
        orgId,
        sql`${automationJobs.payloadRedacted}->>'stepId' = ${stepId}`
      );
      await this.lockSettings(tx, orgId);
      await tx
        .delete(reminderSteps)
        .where(and(eq(reminderSteps.id, stepId), eq(reminderSteps.organisationId, orgId)));
      await tx.insert(auditLogs).values({
        organisationId: orgId,
        actorUserId: context.user.id,
        action: "reminder_step_deleted",
        entityType: "reminder_step",
        entityId: stepId,
        metadataRedacted: { relativeDays: existing.relativeDays }
      });
    });
    return { deleted: true };
  }

  async setInvoicePreference(
    context: ActiveOrganisationContext,
    invoiceId: string,
    enabled: boolean
  ) {
    const orgId = context.activeOrganisation.id;
    const [invoice] = await this.databaseService.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.organisationId, orgId)))
      .limit(1);
    if (!invoice) throw new NotFoundException("Invoice was not found.");
    await this.databaseService.db.transaction(async (tx) => {
      if (!enabled)
        await this.lockReminderJobs(tx, orgId, eq(automationJobs.resourceId, invoiceId));
      await tx
        .update(invoices)
        .set({ automaticRemindersEnabled: enabled, updatedAt: new Date() })
        .where(and(eq(invoices.id, invoiceId), eq(invoices.organisationId, orgId)));
      await tx.insert(auditLogs).values({
        organisationId: orgId,
        actorUserId: context.user.id,
        action: "invoice_reminder_preference_changed",
        entityType: "invoice",
        entityId: invoiceId,
        metadataRedacted: { automaticRemindersEnabled: enabled }
      });
    });
    return { invoiceId, automaticRemindersEnabled: enabled };
  }

  async setCustomerPreference(
    context: ActiveOrganisationContext,
    customerId: string,
    enabled: boolean
  ) {
    const orgId = context.activeOrganisation.id;
    const [customer] = await this.databaseService.db
      .select()
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.organisationId, orgId)))
      .limit(1);
    if (!customer) throw new NotFoundException("Customer was not found.");
    await this.databaseService.db.transaction(async (tx) => {
      if (!enabled)
        await this.lockReminderJobs(
          tx,
          orgId,
          sql`${automationJobs.resourceId} in
        (select id from invoices where organisation_id = ${orgId} and customer_id = ${customerId})`
        );
      await tx
        .update(customers)
        .set({ automaticRemindersEnabled: enabled, updatedAt: new Date() })
        .where(and(eq(customers.id, customerId), eq(customers.organisationId, orgId)));
      await tx.insert(auditLogs).values({
        organisationId: orgId,
        actorUserId: context.user.id,
        action: "customer_reminder_preference_changed",
        entityType: "customer",
        entityId: customerId,
        metadataRedacted: { automaticRemindersEnabled: enabled }
      });
    });
    return { customerId, automaticRemindersEnabled: enabled };
  }
}
