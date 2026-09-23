import { eq } from "drizzle-orm";

import { organisationReminderSettings, organisations, reminderSteps, users } from "../../database/schema";
import { requiredRow, startApiTestPool, uniqueSlug, type ApiTestPool } from "../../test/postgres-test-helper";
import { AuditLogService } from "../audit-log/audit-log.service";
import { ReminderSettingsService } from "./reminder-settings.service";

jest.setTimeout(180000);

let pool: ApiTestPool;

beforeAll(async () => { pool = await startApiTestPool(); });
afterAll(async () => pool.stop());

it("rolls back settings and steps when replacement insertion fails", async () => {
  const db = pool.db;
  const slug = uniqueSlug("reminder-rollback");
  const organisation = requiredRow(await db.insert(organisations).values({ name: "Reminder Org", slug }).returning(), "organisation");
  const user = requiredRow(await db.insert(users).values({ email: `${slug}@example.test`, name: "Owner", passwordHash: "x" }).returning(), "user");
  await db.insert(organisationReminderSettings).values({ organisationId: organisation.id, enabled: false, updatedByUserId: user.id });
  await db.insert(reminderSteps).values({ organisationId: organisation.id, relativeDays: -3, subjectTemplate: "Original", bodyTemplate: "Original message", sortOrder: 0 });
  const service = new ReminderSettingsService(pool.databaseService(), { create: jest.fn() } as unknown as AuditLogService);
  await expect(service.putSettings({ activeOrganisation: organisation, user } as never, {
    enabled: true,
    steps: [{ relativeDays: 1, subjectTemplate: "X".repeat(301), bodyTemplate: "Replacement message" }]
  })).rejects.toThrow();
  const [settings] = await db.select().from(organisationReminderSettings).where(eq(organisationReminderSettings.organisationId, organisation.id));
  const steps = await db.select().from(reminderSteps).where(eq(reminderSteps.organisationId, organisation.id));
  expect(settings?.enabled).toBe(false);
  expect(steps).toHaveLength(1);
  expect(steps[0]).toMatchObject({ relativeDays: -3, subjectTemplate: "Original" });
});
