import "reflect-metadata";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { RecurringInvoicesController } from "./recurring-invoices.controller";
import { RecurringInvoicesService } from "./recurring-invoices.service";
import { ReminderSettingsController } from "./reminder-settings.controller";
import { ReminderSettingsService } from "./reminder-settings.service";
import { ScheduledSendService } from "./scheduled-send.service";

describe("automation HTTP validation", () => {
  let app: INestApplication;
  let baseUrl: string;
  const recurring = {
    createSchedule: jest.fn().mockResolvedValue({ ok: true }),
    updateSchedule: jest.fn().mockResolvedValue({ ok: true })
  };
  const reminders = { putSettings: jest.fn(), updateStep: jest.fn() };
  const scheduled = { scheduleSend: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [RecurringInvoicesController, ReminderSettingsController],
      providers: [
        { provide: RecurringInvoicesService, useValue: recurring },
        { provide: ReminderSettingsService, useValue: reminders },
        { provide: ScheduledSendService, useValue: scheduled }
      ]
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  });
  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());

  const schedule = {
    name: "Monthly service",
    customerId: "00000000-0000-4000-8000-000000000001",
    startDate: "2099-10-01",
    frequency: "monthly",
    lineItems: [{ description: "Service", quantity: 1, unitPriceKobo: 10000 }]
  };

  it.each([
    { ...schedule, dueTermsDays: -1 },
    { ...schedule, startDate: "2099-02-31" },
    { ...schedule, lineItems: [{ description: "Service", quantity: 0, unitPriceKobo: 10000 }] }
  ])("rejects invalid schedule input before mutation", async (body) => {
    const response = await fetch(`${baseUrl}/recurring-invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    expect(response.status).toBe(400);
    expect(recurring.createSchedule).not.toHaveBeenCalled();
  });

  it.each([
    ["POST", "/reminder-settings", { enabled: "true" }],
    ["PATCH", "/reminder-settings/steps/step", { relativeDays: 61 }],
    ["POST", "/invoices/invoice/schedule-send", { scheduledSendDate: "2099-02-31" }],
    ["PATCH", "/recurring-invoices/schedule", { lineItems: [] }]
  ])("validates %s %s at the HTTP boundary", async (method, route, body) => {
    const response = await fetch(baseUrl + route, {
      method: method as string,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    expect(response.status).toBe(400);
    expect(reminders.putSettings).not.toHaveBeenCalled();
    expect(reminders.updateStep).not.toHaveBeenCalled();
    expect(scheduled.scheduleSend).not.toHaveBeenCalled();
    expect(recurring.updateSchedule).not.toHaveBeenCalled();
  });

  it("converts valid numeric fields and keeps validated content", async () => {
    const response = await fetch(`${baseUrl}/recurring-invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...schedule,
        lineItems: [{ description: "Service", quantity: "1.25", unitPriceKobo: "10000" }]
      })
    });
    expect(response.status).toBe(201);
    expect(recurring.createSchedule).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        lineItems: [expect.objectContaining({ quantity: 1.25, unitPriceKobo: 10000 })]
      })
    );
  });
});
