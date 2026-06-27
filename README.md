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

## Scripts

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm format
pnpm format:check
```

## Current Implementation Status

T002 sets up the repository and tooling foundation only. It intentionally does not implement auth, onboarding, customers, invoices, payments, receipts, RBAC, database schema tables, migrations, or Paystack logic.

Implemented in this setup:

- Minimal Next.js app shell page.
- NestJS API with `GET /health`.
- Shared constants, types, and money helpers.
- Money helper unit tests.
- CI workflow for install, lint, typecheck, test, and build.

Next planned task: T003 auth, automatic organisation creation, RBAC foundation, and business onboarding.
