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
```

`pnpm db:push` is available for local development experiments only. Migrations remain the source of truth.

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

The seed adds 24 demo invoices: 6 draft, 6 sent, 4 viewed, 5 overdue, 2 cancelled, and 1 void. It also prints sample public invoice URLs for sent/viewed/overdue invoices. Paid and partially paid invoices are intentionally not seeded yet because payment and reconciliation flows start in later tasks.

## Payment Setup Flow

Before a business can accept online invoice payments:

1. Login as Owner/Admin.
2. Complete the business profile.
3. Open Payment Setup.
4. Select bank.
5. Resolve account.
6. Confirm account name.
7. Create Paystack subaccount.
8. Public invoice Pay Online becomes available.

For test/demo usage, use Paystack test bank and account details where available. Do not use real production banking data in screenshots or portfolio demos.

## Local Paystack Webhook Testing

Paystack needs a public webhook URL to call your local API. In local development, use a tunnel such as ngrok and configure the Paystack dashboard webhook URL as:

```text
https://your-tunnel.example/payments/paystack/webhook
```

The API verifies `x-paystack-signature` against the exact raw request body with `PAYSTACK_SECRET_KEY`. Do not send handcrafted JSON through tools that change the body when validating signatures. For automated tests, the project signs raw fixture buffers directly and does not call Paystack.

## Auth Session Trade-Off

The frontend currently stores access and refresh tokens in `localStorage` for MVP development speed. This keeps the MVP simple and demoable, but it is not the preferred production design. A later hardening task should move sessions to secure, HTTP-only cookies and add CSRF-aware flows where needed.

## Current Implementation Status

T009 adds Paystack webhook reconciliation for confirmed payments. It intentionally does not implement receipts, dashboard metrics, exports, email, PDF generation, or reminders.

Payment Setup and organisation subaccount support are planned MVP work and now gate public payment initialization in the product specification, even though the runtime implementation lands in later tasks.

Implemented so far:

- Minimal Next.js app shell page.
- NestJS API with `GET /health`.
- Shared constants, types, and money helpers.
- Money helper unit tests.
- CI workflow for install, lint, typecheck, test, and build.
- Auth endpoints for register, login, refresh, logout, and current user.
- Business profile onboarding endpoints and UI.
- Dashboard shell gated by onboarding status.
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

Next planned implementation task: T011 Organisation Payment Setup and Paystack Subaccounts.
