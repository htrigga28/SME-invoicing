import { expect, test } from "@playwright/test";

const password = process.env.E2E_DEMO_PASSWORD ?? "DemoPass123!";

test("marketing proof stays useful without overflow or motion", async ({ page }) => {
  await page.goto(process.env.E2E_SITE_URL ?? "http://localhost:3102/");
  await expect(page.getByText("Lumina").first()).toBeVisible();
  await expect(page.getByText("Illustrative demo data").first()).toBeVisible();
  await expect(page.getByText("INV-000184").first()).toBeVisible();
  const overflow = await page.evaluate(() => ({
    widths: { scroll: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth },
    offenders: Array.from(document.querySelectorAll<HTMLElement>("*"))
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.right > window.innerWidth + 1 || rect.left < -1)
      .slice(0, 8)
      .map(({ element, rect }) => ({
        tag: element.tagName,
        className: element.className,
        left: rect.left,
        right: rect.right,
        parents: [element.parentElement?.className, element.parentElement?.parentElement?.className],
        allowed: Boolean(element.closest(".outcome-tabs, .trail-route, .hero-orbits, .signup-route"))
      }))
  }));
  const uncontainedOverflow = overflow.offenders.filter(({ allowed }) => !allowed);
  expect(uncontainedOverflow, JSON.stringify(overflow.offenders)).toHaveLength(0);
});

test("owner can open invoice entry and find named line-item controls", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("owner@demo.com");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /login|sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByRole("link", { name: /create invoice/i })).toBeVisible();
  await page.goto("/invoices/new");
  await expect(page.getByRole("spinbutton", { name: /line item 1 quantity/i })).toHaveAccessibleName(
    "Line item 1 quantity"
  );
  await expect(page.getByRole("spinbutton", { name: /line item 1 unit price/i })).toHaveAccessibleName(
    "Line item 1 unit price in NGN"
  );
});

test("viewer cannot call owner-only team settings", async ({ request }) => {
  const apiUrl = process.env.E2E_API_URL ?? "http://localhost:4100";
  const loginResponse = await request.post(`${apiUrl}/auth/login`, {
    data: { email: "viewer@demo.com", password }
  });
  expect(loginResponse.ok()).toBeTruthy();
  const { accessToken } = await loginResponse.json();
  const teamResponse = await request.get(`${apiUrl}/team/members`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  expect(teamResponse.status()).toBe(403);
});

test("owner completes the catalogue invoice journey from authoring to stubbed payment truth", async ({
  browser,
  request
}) => {
  const apiUrl = process.env.E2E_API_URL ?? "http://localhost:4100";

  const loginResponse = await request.post(`${apiUrl}/auth/login`, {
    data: { email: "owner@demo.com", password }
  });
  expect(loginResponse.ok()).toBeTruthy();
  const { accessToken } = await loginResponse.json();
  const authHeaders = { Authorization: `Bearer ${accessToken}` };

  const resolveResponse = await request.post(`${apiUrl}/payment-setup/resolve-account`, {
    headers: authHeaders,
    data: { bankCode: "033", accountNumber: "0123456789" }
  });
  expect(resolveResponse.ok()).toBeTruthy();
  const subaccountResponse = await request.post(`${apiUrl}/payment-setup/subaccount`, {
    headers: authHeaders,
    data: {
      bankCode: "033",
      accountNumber: "0123456789",
      confirmedAccountName: "Akin & Co Creative Services"
    }
  });
  expect(subaccountResponse.ok()).toBeTruthy();

  const catalogueResponse = await request.get(`${apiUrl}/catalogue-items?status=active`, {
    headers: authHeaders
  });
  expect(catalogueResponse.ok()).toBeTruthy();
  const catalogueBody = await catalogueResponse.json();
  const catalogueItem = catalogueBody.catalogueItems.find(
    (item) => item.name === "Monthly bookkeeping support" && item.status === "active"
  );
  expect(catalogueItem?.id).toBeTruthy();

  const page = await browser.newPage();
  try {
    await page.goto("/login");
    await page.getByLabel("Email").fill("owner@demo.com");
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /login|sign in/i }).click();
    await expect(page).toHaveURL(/dashboard/);

    await page.goto("/products-services");
    await expect(page.getByText("Monthly bookkeeping support").first()).toBeVisible();

    await page.goto("/invoices/new");
    await page.getByLabel("Customer", { exact: true }).selectOption({ label: "Lagos Bright Prints" });
    await page.getByLabel(/Customer reference/).fill("PO-E2E-001");
    await page.getByRole("button", { name: "Net 7" }).click();
    await page.getByLabel("Customer memo").fill("E2E catalogue journey memo.");

    await page.getByLabel("Add from catalogue", { exact: true }).selectOption(catalogueItem.id);
    await page.getByRole("button", { name: "Add selected" }).click();
    await page.getByRole("spinbutton", { name: "Line item 1 quantity" }).fill("2");
    await expect(page.getByText("Monthly bookkeeping support").first()).toBeVisible();

    await page.getByRole("button", { name: "Add ad-hoc line" }).click();
    await page.getByLabel("Line item 2 description").fill("E2E ad-hoc installation");
    await page.getByLabel("Line item 2 quantity").fill("3");
    await page.getByLabel("Line item 2 unit price in NGN").fill("2500");

    await expect(page.getByText("Draft preview")).toBeVisible();
    await expect(page.getByText("E2E ad-hoc installation")).toBeVisible();

    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]+$/, { timeout: 15_000 });
    const createdInvoiceId = page.url().split("/").pop() ?? "";
    expect(createdInvoiceId).toMatch(/[0-9a-f-]{8,}/);
    await expect(page.getByText("PO-E2E-001")).toBeVisible();

    await page.getByRole("button", { name: "Duplicate", exact: true }).click();
    await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]+\/edit$/, { timeout: 15_000 });
    await expect(page.getByText(/Duplicated as draft/)).toBeVisible();
    const duplicatedInvoiceId = page.url().split("/invoices/")[1]?.split("/")[0] ?? "";
    expect(duplicatedInvoiceId).not.toBe(createdInvoiceId);

    await page.getByRole("button", { name: "Save and send", exact: true }).click();
    await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]+$/, { timeout: 15_000 });
    await expect(page.getByText("Sent").first()).toBeVisible({ timeout: 15_000 });

    const detailResponse = await request.get(`${apiUrl}/invoices/${duplicatedInvoiceId}`, {
      headers: authHeaders
    });
    expect(detailResponse.ok()).toBeTruthy();
    const detailBody = await detailResponse.json();
    expect(detailBody.invoice.status).toBe("sent");
    const publicUrl = String(detailBody.publicUrl ?? "");
    expect(publicUrl).toContain("/invoice/");
    const publicToken = publicUrl.split("/invoice/")[1] ?? "";
    expect(publicToken.length).toBeGreaterThan(10);

    await page.goto(`/invoice/${publicToken}`);
    await expect(page.getByText("E2E ad-hoc installation")).toBeVisible();
    await expect(page.getByText("PO-E2E-001")).toBeVisible();

    const payResponse = await request.post(`${apiUrl}/public/invoices/${publicToken}/pay`, {
      data: {}
    });
    expect(payResponse.ok()).toBeTruthy();
    const payBody = await payResponse.json();
    expect(String(payBody.authorizationUrl)).toContain("127.0.0.1:4599");
    const paymentReference = String(payBody.reference ?? "");
    expect(paymentReference.length).toBeGreaterThan(0);

    const verifyResponse = await request.post(
      `${apiUrl}/public/invoices/${publicToken}/payments/${encodeURIComponent(paymentReference)}/verify`
    );
    expect(verifyResponse.ok()).toBeTruthy();
    const verifyBody = await verifyResponse.json();
    expect(verifyBody.status).toBe("successful");
    expect(verifyBody.invoiceUpdated).toBe(true);

    const refreshedResponse = await request.get(`${apiUrl}/invoices/${duplicatedInvoiceId}`, {
      headers: authHeaders
    });
    expect(refreshedResponse.ok()).toBeTruthy();
    const refreshedBody = await refreshedResponse.json();
    expect(refreshedBody.invoice.balanceDueKobo).toBe(0);
    expect(["paid", "partially_paid"]).toContain(refreshedBody.invoice.status);
    const successfulPayment = (refreshedBody.payments ?? []).find(
      (payment) => payment.providerReference === paymentReference
    );
    expect(successfulPayment?.receipt).toBeTruthy();

    await page.goto(`/invoice/${publicToken}`);
    await expect(page.getByText("NGN 0.00").first()).toBeVisible();

    await page.emulateMedia({ media: "print" });
    await expect(page.getByText("E2E ad-hoc installation")).toBeVisible();
    await page.emulateMedia({ media: "screen" });
  } finally {
    await page.close();
  }
});

test("invoice authoring stays usable at mobile width with a full-screen preview", async ({
  browser
}) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto("/login");
    await page.getByLabel("Email").fill("owner@demo.com");
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /login|sign in/i }).click();
    await expect(page).toHaveURL(/dashboard/);

    await page.goto("/invoices/new");
    await page.getByRole("button", { name: "Preview invoice" }).click();
    await expect(page.getByRole("dialog", { name: "Invoice preview" })).toBeVisible();
    await page.getByRole("button", { name: "Close preview" }).click();
    await expect(page.getByRole("dialog", { name: "Invoice preview" })).not.toBeVisible();

    const overflow = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth
    }));
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.viewport + 1);
  } finally {
    await page.close();
  }
});
