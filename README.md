# SME Invoice & Payment Reconciliation Platform

A standalone B2B SaaS portfolio project for Nigerian SMEs, freelancers, agencies, and service providers. The MVP will support invoices, public invoice payment links, Paystack test payments, webhook-based payment reconciliation, receipts, exports, and audit logs.

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
- Paystack secret and webhook config
- Frontend/backend URL and CORS origins
- Later Brevo and Cloudflare R2 credentials

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

Run `pnpm db:migrate` and `pnpm db:seed` first. The seed is idempotent and can be run multiple times without duplicating the demo organisation, users, memberships, business profile, or seeded invitations.

| Role       | Email                 | Password       |
| ---------- | --------------------- | -------------- |
| Owner      | `owner@demo.com`      | `DemoPass123!` |
| Admin      | `admin@demo.com`      | `DemoPass123!` |
| Accountant | `accountant@demo.com` | `DemoPass123!` |
| Viewer     | `viewer@demo.com`     | `DemoPass123!` |

Seeded Owner/Admin users can access `/settings/team`. Seeded Accountant/Viewer users should receive an access-denied state. Pending development invitation URLs are printed to the console when `pnpm db:seed` runs; raw invitation tokens are not stored in the database.

## Auth Session Trade-Off

The frontend currently stores access and refresh tokens in `localStorage` for MVP development speed. This keeps the MVP simple and demoable, but it is not the preferred production design. A later hardening task should move sessions to secure, HTTP-only cookies and add CSRF-aware flows where needed.

## Current Implementation Status

T004 adds team invitations, member management, and development seed data on top of the auth, tenant context, RBAC foundation, database foundation, and business profile onboarding flow. It intentionally does not implement customers, invoices, payments, receipts, dashboard metrics, exports, or Paystack logic.

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

Next planned task: T005 customer management.
