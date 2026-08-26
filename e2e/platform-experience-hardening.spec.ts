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
