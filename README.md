# SME Invoice & Payment Reconciliation Platform

A standalone B2B SaaS portfolio project for Nigerian SMEs, freelancers, agencies, and service providers. The MVP will support invoices, organisation Payment Setup, public invoice payment links, Paystack test payments, webhook-based payment reconciliation, receipts, exports, and audit logs.

## Stack

- Monorepo: pnpm workspaces and Turborepo
- Frontend: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui-ready structure
- Backend: NestJS, TypeScript, ConfigModule, Swagger placeholder, global validation placeholder
- Database tooling: PostgreSQL with Drizzle placeholders
- Shared code: TypeScript package for constants, types, and money helpers
- Validation: Zod
- Testing: Vitest for shared/frontend, Jest for the NestJS API
- CI: GitHub Actions

## Monorepo Structure

```text
apps/
  web/       Next.js frontend
  api/       NestJS backend
packages/
  shared/    Shared constants, types, and helpers
  config/    Shared config placeholders
docs/         Governance and planning docs
infra/        Infrastructure notes/placeholders
```

## Local Setup

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm dev
```

`pnpm dev` starts workspace dev tasks through Turborepo. The web app defaults to `http://localhost:3000`; the API defaults to `http://localhost:4000`.

## Environment Setup

Use [.env.example](./.env.example) as the starting point. T002 only adds placeholders; real secrets must not be committed.

Required categories:

- Frontend API URL and Paystack public key
- Database URL
- JWT secrets
- Paystack secret, optional base URL, and webhook config
- Frontend/backend URL and CORS origins
- Later Brevo and Cloudflare R2 credentials

Payment Setup notes:

- Payment Setup is required before public invoice payment can be initialized.
- After business profile completion, the app redirects users into Payment Setup and the dashboard shows a follow-up CTA until online payments are active.
- Local/test mode uses Paystack test keys.
- `PAYSTACK_SECRET_KEY` must be configured on the backend for bank listing, account resolution, subaccount creation, payment initialization, and webhook verification.
- `PAYSTACK_BASE_URL` defaults to `https://api.paystack.co` and is only needed when pointing local tests at a mock provider.
- Never commit real Paystack keys.
- The platform does not store merchant Paystack secret keys; it uses one platform Paystack integration and organisation subaccounts.

## Local PostgreSQL Setup

The app uses the PostgreSQL server running locally on your machine. Docker Compose is not the primary database workflow.

1. Ensure PostgreSQL is running locally on port `5432`.
2. Create the development database:

   ```bash
   createdb sme_invoicing_dev
   ```

3. Create the test database:

   ```bash
   createdb sme_invoicing_test
   ```

4. Set database URLs in `.env`:

   ```bash
   DATABASE_URL="postgresql://your_user:your_password@localhost:5432/sme_invoicing_dev"
   TEST_DATABASE_URL="postgresql://your_user:your_password@localhost:5432/sme_invoicing_test"
   ```

   If local PostgreSQL uses peer/trust authentication and no password is required:

   ```bash
   DATABASE_URL="postgresql://your_user@localhost:5432/sme_invoicing_dev"
   TEST_DATABASE_URL="postgresql://your_user@localhost:5432/sme_invoicing_test"
   ```

   Replace `your_user` and `your_password` with real local PostgreSQL credentials. Do not include literal placeholder brackets such as `<user>`.

5. Install dependencies:

   ```bash
   pnpm install
   ```

6. Run migrations:

   ```bash
   pnpm db:migrate
   ```

7. Seed development demo data:

   ```bash
   pnpm db:seed
   ```

8. Start the app:

   ```bash
   pnpm dev
   ```

9. Login at `/login` with `owner@demo.com` / `DemoPass123!`.

10. Run validation:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Scripts

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm format
pnpm format:check
pnpm db:generate
pnpm db:migrate
pnpm db:studio
pnpm db:test:migrate
pnpm db:seed
pnpm payments:reconcile-invoices
```

`pnpm db:push` is available for local development experiments only. Migrations remain the source of truth.

`pnpm payments:reconcile-invoices` recalculates invoice `amount_paid_kobo`, `balance_due_kobo`, and payment-derived status from persisted payment/refund truth. It is safe to run after local manual Paystack testing or seeded data changes.

## Demo Login

Run `pnpm db:migrate` and `pnpm db:seed` first. The seed is idempotent and can be run multiple times without duplicating the demo organisation, users, memberships, business profile, seeded invitations, demo customers, or demo invoices.

| Role       | Email                 | Password       |
| ---------- | --------------------- | -------------- |
| Owner      | `owner@demo.com`      | `DemoPass123!` |
| Admin      | `admin@demo.com`      | `DemoPass123!` |
| Accountant | `accountant@demo.com` | `DemoPass123!` |
| Viewer     | `viewer@demo.com`     | `DemoPass123!` |

Seeded Owner/Admin users can access `/settings/team`. Seeded Accountant/Viewer users should receive an access-denied state. Pending development invitation URLs are printed to the console when `pnpm db:seed` runs; raw invitation tokens are not stored in the database.

The seed also adds 12 realistic demo customers to the demo organisation. Ten are active and two are archived so `/customers` can demonstrate active, archived, and all status filters.

The seed adds 24 demo invoices and updates a subset with deterministic demo payments: 6 full successful payments mark invoices paid, 4 partial successful payments mark invoices partially paid, and pending/failed/abandoned payments remain visible without changing invoice paid state. It also prints sample public invoice URLs for sent/viewed/overdue invoices.

Seeded payment data is local-only and does not create Paystack transactions. Historical demo payment records use a clearly fake disabled subaccount code for settlement traceability; the seed does not create a fake active Payment Setup account.

## Payment Setup Flow

Manual local test flow:

1. Login as Owner/Admin.
2. Complete the business profile.
3. Ensure `PAYSTACK_SECRET_KEY` is set to a Paystack test secret key.
4. Follow the redirect to `/settings/payment-setup` or use the dashboard CTA.
5. Select a Nigerian bank.
6. Enter a Paystack test 10-digit account number.
7. Resolve the account and confirm the masked account details.
8. Activate payouts to create the organisation Paystack subaccount.
9. Verify the status card shows provider, bank, account name, account last4, status, and verified/delayed state.
10. Login as Accountant/Viewer and confirm the page is read-only.

For test/demo usage, use Paystack test bank and account details where available. Do not use real production banking data in screenshots or portfolio demos.

T011 stores the organisation Paystack subaccount and masked payout details. T012 makes the public invoice Pay Online flow require an active setup and initializes Paystack with the stored subaccount.

Payment initialization QA:

1. Create or confirm Payment Setup as Owner/Admin.
2. Send an invoice and open its public invoice URL.
3. Confirm Pay Online is available only when Payment Setup status is active.
4. Start Pay Online and confirm Paystack receives the organisation subaccount server-side.
5. Disable Payment Setup from `/settings/payment-setup`.
6. Reload the public invoice and confirm viewing still works while Pay Online is unavailable.
7. Reactivate the disabled payout account or create a different active payment account when testing payments again.

## Payments and Reconciliation Flow

The internal payments module is available at `/payments`; payment details are available at `/payments/:id`.

Manual local test flow:

1. Login as any demo organisation member.
2. Open `/payments`.
3. Review collected, pending, failed/abandoned, and review-required summary cards.
4. Search by Paystack-like reference, invoice number, or customer name.
5. Filter by status or reconciliation state.
6. Confirm the default Reconciliation view hides superseded retry attempts.
7. Switch to All attempts to inspect historical failed/pending/abandoned checkout attempts kept for audit/support.
8. Switch to Needs review to inspect true reconciliation problems only.
9. Open a payment detail page and confirm the linked invoice, customer, masked settlement account, attempt lifecycle, and safe event timeline render.
10. For an overpaid payment, confirm Owner/Admin can open the Resolve overpayment dialog, enter a reason, and send a Paystack refund request. Accountant/Viewer should see read-only refund state.
11. Open an invoice detail page with linked payments and confirm the Payments section shows financial summary, refunds, and overpayment warning when applicable.
12. Use pagination after switching filters/views and confirm Previous/Next remains visible when matching records exist.

The Payments module separates checkout attempts from reconciliation records, hides superseded retries from the default view, keeps all attempts available for audit/support, and exposes one T013 mutation: Owner/Admin can request a Paystack refund for invoice overpayments. It does not manually reconcile payments, export CSV files, or expose raw webhook payloads.

## Receipts

T014 issues one immutable receipt for each provider-confirmed successful payment. Receipts snapshot business, customer, invoice number, payment reference, channel, paid date, and original payment amount. Processed refunds are shown as a derived refund summary; the original receipt amount is not rewritten.

Backfill existing successful payments after migrations and seed data:

```bash
pnpm receipts:backfill
```

Manual receipt QA:

1. Run `pnpm db:seed`, then `pnpm receipts:backfill`.
2. Log in as any demo user and open `/receipts`.
3. Confirm successful demo payments have `RCT-000001` style receipt numbers.
4. Open a receipt detail page and confirm invoice, payment, customer, refund summary, public link, copy action, and print action render.
5. Open the public `/receipt/:token` URL and confirm it loads without login or app navigation.
6. Process or seed a refund and confirm the receipt still shows original payment amount plus refunded/net-retained summary.

## Local Paystack Webhook Testing

Paystack cannot send a webhook to a localhost-only URL. In local development, use a publicly reachable tunnel such as ngrok and configure the Paystack Test Mode webhook URL as:

```text
https://your-tunnel.example/payments/paystack/webhook
```

The API verifies `x-paystack-signature` against the exact raw request body with `PAYSTACK_SECRET_KEY`. Do not send handcrafted JSON through tools that change the body when validating signatures. For automated tests, the project signs raw fixture buffers directly and does not call Paystack.

After Paystack redirects the customer back to the public invoice page, the frontend calls a backend Verify Transaction fallback once. This fallback can reconcile a returned transaction if the webhook has not arrived yet, but it still calls Paystack server-side and validates the reference, amount in kobo, and currency before updating payment or invoice state. The webhook remains the preferred confirmation path.

Manual Paystack confirmation check:

1. Complete a Paystack test payment from a public invoice.
2. Copy the payment reference from the callback URL or payment detail.
3. Confirm a payment row exists for that reference.
4. Confirm webhook logs show safe received/processed metadata when using a tunnel.
5. Confirm a `charge.success` payment event exists when the webhook is delivered.
6. Confirm the payment becomes successful and the invoice paid/balance/status fields update.
7. If webhook delivery is unavailable locally, confirm the callback verification fallback updates the same payment without exposing raw Paystack data.

Manual overpayment/refund check:

1. Create or locate an invoice with two successful payments whose net total exceeds the invoice total.
2. Run `pnpm payments:reconcile-invoices` if local invoice fields are stale after manual webhook/verification testing.
3. Open `/payments` and confirm the invoice appears in Needs review as an overpayment, not overdue or partially paid.
4. Open the payment detail page as Owner/Admin and initiate a refund for the excess amount.
5. Confirm the refund shows pending/processing until Paystack sends a processed refund event.
6. Simulate or receive `refund.processed` and confirm the invoice financial summary recalculates from successful payments minus processed refunds.

## Auth Session Trade-Off

The frontend currently stores access and refresh tokens in `localStorage` for MVP development speed. This keeps the MVP simple and demoable, but it is not the preferred production design. A later hardening task should move sessions to secure, HTTP-only cookies and add CSRF-aware flows where needed.

## Current Implementation Status

T009 adds Paystack webhook reconciliation for confirmed payments. It intentionally does not implement dashboard metrics, exports, email, PDF generation, or reminders.

Payment Setup and organisation subaccount support now gate public payment initialization at runtime. Public invoice viewing still works without Payment Setup.

The Payments module provides reconciliation visibility for Paystack references, invoice/customer matches, safe webhook/refund event summaries, masked settlement payout accounts, and Owner/Admin overpayment refund requests. The Receipts module generates immutable receipts for successful payments and exposes internal/public receipt pages.

Implemented so far:

- Minimal Next.js app shell page.
- NestJS API with `GET /health`.
- Shared constants, types, and money helpers.
- Money helper unit tests.
- CI workflow for install, lint, typecheck, test, and build.
- Auth endpoints for register, login, refresh, logout, and current user.
- Business profile onboarding endpoints and UI.
- Dashboard shell gated by onboarding status, with a Payment Setup CTA until online payments are active.
- Team invitation and member management endpoints.
- Team settings and invitation acceptance UI.
- Idempotent development seed data with demo users and invitation records.
- Customer list, create, detail, edit, and archive API/UI.
- Idempotent development seed data with active and archived demo customers.
- Invoice list, create, draft edit, detail, send, cancel, and void API/UI.
- Server-side invoice numbering, public tokens, totals, status events, and invoice seed data.
- Public invoice API and `/invoice/[token]` page with customer-facing invoice details.
- Public view tracking that moves sent invoices to viewed without duplicating transitions.
- Paystack payment initialization from payable public invoices.
- Pending payment records with Paystack reference, access code, authorization URL, and safe audit metadata.
- Paystack webhook signature verification, redacted payment events, idempotent `charge.success` processing, and invoice paid/balance recalculation.
- Organisation Payment Setup with Paystack bank resolution, account confirmation, subaccount creation, and masked payout account storage.
- Subaccount-aware public invoice payment initialization that requires active Payment Setup.
- Payments and Reconciliation pages with payment lists, detail views, safe event timelines, settlement account summaries, overpayment detection, Paystack excess-refund requests, and seeded demo payment history.
- Receipts module with successful-payment receipt generation, refund-aware receipt summaries, public receipt pages, and `pnpm receipts:backfill`.

Next planned implementation task: T015 Dashboard Metrics.
