import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

const customer = { id: "customer-1", name: "Northstar", email: "accounts@example.test", phone: null, billingAddress: null, status: "active", archivedAt: null };
const longSubject = `Monthly retainer ${"LongSubject".repeat(18)}`;
const schedule = {
  id: "schedule-1", name: "Monthly retainer", status: "active", frequency: "monthly",
  customerId: customer.id, customerName: customer.name, amountKobo: 7840000,
  nextIssueDate: "2026-10-30", startDate: "2026-09-30", endDate: null,
  dueTermsDays: 14, autoSend: true, toRecipients: [`${"longrecipient".repeat(5)}@example.test`],
  ccRecipients: ["finance@example.test"], emailSubject: longSubject,
  discountKobo: 0, taxKobo: 0, lastGeneratedAt: "2026-09-30T06:00:00Z"
};

function recurringDetail() {
  return {
    schedule,
    lineItems: [{ description: "Bookkeeping", quantity: 1, unitPriceKobo: 7840000 }],
    occurrences: [{ id: "occurrence-1", status: "generated", scheduledFor: "2026-09-30", invoice: {
      id: "invoice-1", invoiceNumber: "INV-000184", status: "sent", issueDate: "2026-09-30", dueDate: "2026-10-14", totalKobo: 7840000, deliveryStatus: "delivered"
    } }],
    automation: [
      { id: "job-1", status: "needs_attention", scheduledFor: "2026-09-30", lastError: `Invoice generation failed: ${"error".repeat(32)}` },
      { id: "job-2", status: "pending", scheduledFor: "2026-10-30", lastError: "Temporary failure" }
    ]
  };
}

function invoiceDetail() {
  return {
    invoice: {
      id: "invoice-1", invoiceNumber: "INV-000184", customer, status: "draft", currency: "NGN",
      issueDate: "2026-09-30", dueDate: "2026-10-14", subtotalKobo: 7840000, discountKobo: 0,
      taxKobo: 0, totalKobo: 7840000, amountPaidKobo: 0, balanceDueKobo: 7840000,
      publicAccessEnabled: false, sentAt: null, paidAt: null, cancelledAt: null, voidedAt: null,
      createdAt: "2026-09-30T06:00:00Z", updatedAt: "2026-09-30T06:00:00Z",
      scheduledSendDate: null as string | null, scheduledSendTo: [] as string[], scheduledSendCc: [] as string[], scheduledSendSubject: null as string | null
    },
    lineItems: [{ id: "line-1", description: "Bookkeeping", quantity: 1, unitPriceKobo: 7840000, lineTotalKobo: 7840000, sortOrder: 0 }],
    statusEvents: [], payments: [], publicUrl: null, viewSummary: null,
    delivery: { state: "not_emailed", message: "Not emailed", attempts: 0, lastCommunication: null },
    financialSummary: { grossSuccessfulKobo: 0, processedRefundsKobo: 0, netReceivedKobo: 0, appliedToInvoiceKobo: 0, overpaymentKobo: 0, balanceDueKobo: 7840000, paymentCount: 0, successfulPaymentCount: 0, hasOverpayment: false },
    paymentSummary: { available: false, reason: "draft", message: "Send the invoice to enable payments." }
  };
}

async function fixtures(page: Page, role = "owner") {
  const requests: { path: string; body: Record<string, unknown> }[] = [];
  const unexpected: string[] = [];
  const suggestions = [-3, 1, 7].map((relativeDays) => ({ relativeDays, subjectTemplate: `Reminder ${relativeDays}: {{invoiceNumber}}`, bodyTemplate: "Hello {{customerName}}, pay {{amountDue}} at {{publicInvoiceUrl}}.", enabled: true }));
  let reminders = { enabled: false, steps: [] as typeof suggestions, suggestedSteps: suggestions };
  const invoice = invoiceDetail();
  await page.addInitScript(() => localStorage.setItem("sme-invoicing-organisation", "org-fixture"));
  await page.route("http://127.0.0.1:4199/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const headers = { "access-control-allow-origin": "http://localhost:3119", "access-control-allow-credentials": "true", "access-control-allow-headers": "authorization,content-type,x-organisation-id", "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const body = request.postDataJSON() as Record<string, unknown> | null;
    if (request.method() !== "GET") requests.push({ path, body: body ?? {} });
    let json: unknown;
    if (path === "/auth/refresh") json = { accessToken: "browser-fixture-token" };
    else if (path === "/me") json = {
      user: { id: "user-fixture", email: "owner@example.test", name: "QA Owner" },
      activeOrganisation: { id: "org-fixture", name: "QA Studio", slug: "qa-studio", onboardingCompletedAt: "2026-09-30T00:00:00Z" },
      membership: { id: "membership-fixture", organisationId: "org-fixture", userId: "user-fixture", role, status: "active" },
      businessProfile: { id: "profile-fixture", organisationId: "org-fixture", businessName: "QA Studio", email: "owner@example.test", phone: null, address: null, logoFileId: null, setupCompletedAt: "2026-09-30T00:00:00Z" },
      onboardingRequired: false, onboardingStep: null
    };
    else if (path === "/reminder-settings") {
      if (body) reminders = { ...reminders, enabled: Boolean(body.enabled), steps: body.steps as typeof suggestions };
      json = reminders;
    } else if (path === "/customers") json = { customers: [customer] };
    else if (path === "/recurring-invoices" && body) json = { schedule: { id: "schedule-1" } };
    else if (path === "/recurring-invoices/schedule-1") json = recurringDetail();
    else if (path === "/invoices/invoice-1/activity") json = { activity: [] };
    else if (path === "/invoices/invoice-1/schedule-send" && body) {
      invoice.invoice.scheduledSendDate = body.scheduledSendDate as string;
      invoice.invoice.scheduledSendTo = body.to as string[];
      invoice.invoice.scheduledSendCc = body.cc as string[];
      invoice.invoice.scheduledSendSubject = body.subject as string;
      json = invoice;
    } else if (path === "/invoices/invoice-1") json = invoice;
    else { unexpected.push(`${request.method()} ${path}`); return route.fulfill({ status: 500, headers, json: { message: `Missing browser fixture: ${path}` } }); }
    await route.fulfill({ headers, json });
  });
  return { requests, unexpected };
}

async function inspectLayout(page: Page, info: TestInfo, name: string, controls: Locator[]) {
  const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(widths.content, JSON.stringify(widths)).toBeLessThanOrEqual(widths.viewport + 1);
  for (const control of controls) {
    const bounds = await control.boundingBox();
    expect(bounds, `Visible control: ${await control.getAttribute("aria-label") ?? await control.innerText()}`).not.toBeNull();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(widths.viewport + 1);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: !name.endsWith("dialog"), style: "nextjs-portal { display: none; }" });
}

test("reminder defaults persist and the editor adds and edits without eager writes", async ({ page }, info) => {
  const state = await fixtures(page);
  await page.goto("/settings/reminders");
  await expect(page.getByText("3 days before due")).toBeVisible();
  await inspectLayout(page, info, "reminders-defaults", [page.getByRole("button", { name: "Turn on" }), page.getByRole("button", { name: "Add reminder" })]);
  await page.getByRole("button", { name: "Turn on" }).click();
  await expect(page.getByRole("button", { name: "Turn off" })).toBeVisible();
  expect(state.requests.find((request) => request.path === "/reminder-settings")?.body.steps).toEqual(expect.arrayContaining([-3, 1, 7].map((relativeDays) => expect.objectContaining({ relativeDays }))));
  const saves = state.requests.filter((request) => request.path === "/reminder-settings").length;
  await page.getByRole("button", { name: "Add reminder" }).click();
  await expect(page.getByRole("heading", { name: "New reminder" })).toBeVisible();
  expect(state.requests.filter((request) => request.path === "/reminder-settings")).toHaveLength(saves);
  await page.getByLabel("Timing (days from due date)").fill("14");
  await page.getByLabel("Subject", { exact: true }).fill(longSubject);
  await inspectLayout(page, info, "reminder-editor", [page.getByLabel("Subject", { exact: true }), page.getByRole("button", { name: "Save reminder" })]);
  await page.getByRole("button", { name: "Save reminder" }).click();
  await expect(page.getByText("14 days overdue")).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).last().click();
  await page.getByLabel("Subject", { exact: true }).fill("Updated reminder");
  await page.getByRole("button", { name: "Save reminder" }).click();
  await expect(page.getByText("Updated reminder", { exact: true })).toBeVisible();
  expect(state.unexpected).toEqual([]);
});

test("recurring form accepts naira and line controls with delivery settings", async ({ page }, info) => {
  const state = await fixtures(page);
  await page.goto("/recurring-invoices/new");
  await page.getByLabel("Customer", { exact: true }).selectOption("customer-1");
  await page.getByLabel("Schedule name").fill("Monthly retainer");
  await page.getByRole("button", { name: "Add line" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).first().click();
  await expect(page.getByLabel("Description", { exact: true })).toHaveCount(1);
  await page.getByLabel("Description", { exact: true }).fill("Bookkeeping");
  await page.getByLabel("Quantity", { exact: true }).fill("1.25");
  await page.getByLabel("Unit price (₦)").fill("784.50");
  await page.getByLabel("Discount (₦)").fill("10");
  await page.getByLabel("Tax (₦)").fill("5");
  await page.getByLabel("To", { exact: true }).fill("accounts@example.test");
  await page.getByLabel("CC", { exact: true }).fill("finance@example.test");
  await page.getByLabel("Email subject").fill(longSubject);
  await page.getByLabel("Email each invoice automatically").check();
  await page.getByLabel("On date", { exact: true }).check();
  const endDate = page.getByLabel("End date", { exact: true });
  const selectedEndDate = (await endDate.getAttribute("min"))!;
  await endDate.fill(selectedEndDate);
  await expect(page.getByText("Total NGN 975.63", { exact: true })).toBeVisible();
  await inspectLayout(page, info, "recurring-form", [page.getByLabel("Quantity", { exact: true }), page.getByLabel("Unit price (₦)"), page.getByRole("button", { name: "Save schedule" })]);
  await page.getByRole("button", { name: "Save schedule" }).click();
  await expect(page).toHaveURL(/recurring-invoices\/schedule-1$/);
  expect(state.requests.find((request) => request.path === "/recurring-invoices")?.body).toMatchObject({ lineItems: [{ description: "Bookkeeping", quantity: 1.25, unitPriceKobo: 78450 }], discountKobo: 1000, taxKobo: 500, autoSend: true, ccRecipients: ["finance@example.test"], emailSubject: longSubject, endDate: selectedEndDate });
  expect(state.unexpected).toEqual([]);
});

test("schedule detail shows jobs, a contained confirmation, and direct invoice navigation", async ({ page }, info) => {
  const state = await fixtures(page);
  await page.goto("/recurring-invoices/schedule-1");
  await expect(page.getByText("needs attention", { exact: true })).toBeVisible();
  await expect(page.getByText(/Retry pending/)).toBeVisible();
  await expect(page.getByText("Delivery: delivered")).toBeVisible();
  await inspectLayout(page, info, "recurring-detail", [page.getByRole("button", { name: "End schedule", exact: true }), page.getByRole("link", { name: "View invoice →" })]);
  await page.getByRole("button", { name: "End schedule", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await inspectLayout(page, info, "end-schedule-dialog", [dialog.getByRole("button", { name: "End schedule", exact: true }), dialog.getByRole("button", { name: "Cancel", exact: true })]);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("link", { name: "View invoice →" }).click();
  await expect(page).toHaveURL(/invoices\/invoice-1$/);
  await expect(page.getByRole("heading", { name: "Invoice automation" })).toBeVisible();
  expect(state.unexpected).toEqual([]);
});

test("invoice scheduling shows business-date context and persists recipients and subject", async ({ page }, info) => {
  const state = await fixtures(page);
  await page.goto("/invoices/invoice-1");
  const panel = page.locator("section").filter({ has: page.getByRole("heading", { name: "Invoice automation", exact: true }) });
  await expect(panel.getByText(/issue and email this draft invoice/)).toBeVisible();
  await expect(panel.getByText(/Lagos time \(WAT\).*Exact send time is not guaranteed/)).toBeVisible();
  await panel.getByLabel("To", { exact: true }).fill("accounts@example.test, owner@example.test");
  await panel.getByLabel("CC", { exact: true }).fill("finance@example.test");
  await panel.getByLabel("Subject", { exact: true }).fill(longSubject);
  const date = panel.getByLabel("Schedule send date");
  await date.fill((await date.getAttribute("min"))!);
  await inspectLayout(page, info, "invoice-scheduling", [date, panel.getByRole("button", { name: "Schedule send", exact: true })]);
  await panel.getByRole("button", { name: "Schedule send", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Change schedule", exact: true })).toBeVisible();
  await expect(panel.getByText(/will be issued and emailed on that business date/)).toBeVisible();
  expect(state.requests.find((request) => request.path.endsWith("/schedule-send"))?.body).toMatchObject({ to: ["accounts@example.test", "owner@example.test"], cc: ["finance@example.test"], subject: longSubject });
  expect(state.unexpected).toEqual([]);
});

for (const role of ["accountant", "viewer"]) {
test(`${role} can only read reminder settings`, async ({ page }, info) => {
  const state = await fixtures(page, role);
  await page.goto("/settings/reminders");
  await expect(page.getByText("You can view this reminder sequence. An owner or admin can change it.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add reminder" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Turn on" })).toHaveCount(0);
  await inspectLayout(page, info, `reminders-${role}-readonly`, []);
  expect(state.requests.filter((request) => request.path === "/reminder-settings")).toEqual([]);
  expect(state.unexpected).toEqual([]);
});
}
