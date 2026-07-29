# Lumina Deployment Runbook

This runbook covers the three-project Vercel deployment for Lumina, Neon PostgreSQL, Paystack, DNS, production migrations, rollback, and launch verification. Never paste secret values into this document, an issue, a pull request, a screenshot, or a terminal transcript.

## Final architecture

| Service | Provider | Production address | Purpose |
| --- | --- | --- | --- |
| Marketing | Vercel | `https://lumina.akhigbe.xyz` | Public website, SEO, legal pages, and waitlist |
| Product app | Vercel | `https://app.lumina.akhigbe.xyz` | Authenticated Next.js application and public invoice/receipt pages |
| API | Vercel | `https://api.lumina.akhigbe.xyz` | NestJS request/response API and Paystack webhook |
| Database | Neon | Private connection only | Production PostgreSQL |
| Payments | Paystack | Provider-hosted checkout | Test-mode portfolio payment flow until live-mode approval |
| Email | Brevo, later | Not active | Future transactional email delivery |
| DNS | Pxxl DNS | `akhigbe.xyz` zone | Apex and subdomain records |

The persistent development environment is built from the Git `dev` branch:

| Service | Development address | Vercel environment |
| --- | --- | --- |
| Marketing | `https://dev.lumina.akhigbe.xyz` | Preview, branch `dev` |
| Product app | `https://app.dev.lumina.akhigbe.xyz` | Preview, branch `dev` |
| API | `https://api.dev.lumina.akhigbe.xyz` | Preview, branch `dev` |
| Database | Neon branch `development` | Separate pooled runtime connection |

Vercel Authentication is disabled on all three projects so the development
domains are publicly accessible to external reviewers. Development contains
demo data only and must never reuse production database or JWT credentials.

All three deployable applications remain separate Vercel projects. Do not rename `apps/web`, merge the projects, or move the API to another provider unless the architecture is intentionally revisited.

## Observed Vercel mapping

Dashboard inspection on 2026-07-29 found:

| Vercel project | Repository | Root directory | Preset | Commands | Output | Node | Initial production URL |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `lumina-marketing` | `htrigga28/SME-invoicing` | `apps/marketing` | Next.js | Vercel-managed monorepo build; `pnpm install` detected | Next.js default | 24.x | `https://sme-invoicing-marketing.vercel.app` |
| `lumina-web` | `htrigga28/SME-invoicing` | `apps/web` | Next.js | Vercel-managed Next.js build and package-manager install | Next.js default | 24.x | `https://lumina-web-five.vercel.app` |
| `lumina-api` | `htrigga28/SME-invoicing` | `apps/api` | NestJS | Vercel-managed monorepo build; `pnpm install` detected | Not applicable | 24.x | `https://sme-invoicing-api.vercel.app` |

The API deployment contains one Node.js function at `/index` in `iad1`. The inspected deployment was about 3 MB and exposed the NestJS routes correctly; `GET /health` returned `200 {"status":"ok"}`. No custom Vercel handler or API-host migration is currently required.

All three inspected production deployments from commit `c204ec7` were Ready. Their build logs completed without a failed build. Vercel displayed project recommendations, but no build-blocking warning. Web Analytics and Speed Insights were not enabled.

After URL environment variables were added, the current source was redeployed successfully:

| Service | Production deployment ID | Status |
| --- | --- | --- |
| Marketing | `5AY7zSnKu7fLbjwHFA1DqS3JAC8B` | Ready |
| Product app | `H4U5dTibKqsnXABYft9xyT99oAyw` | Ready |
| API | `8VZd5HiXH3f9tCG7W3hQ56DL3fVj` | Ready |

The product project also received one duplicate redeploy while the first redeploy was not yet visible in the dashboard. Both completed safely; the table records the current production deployment.

## DNS

Pxxl DNS is authoritative for `akhigbe.xyz`. The selected Lumina topology requires the following DNS-only records with a 300-second TTL:

| Type | Name | Target/value | Proxy | Status |
| --- | --- | --- | --- | --- |
| CNAME | `lumina` | `f7a895aad2762b42.vercel-dns-017.com` | DNS only | Configured |
| CNAME | `app.lumina` | `7fba3fe690f6626f.vercel-dns-017.com` | DNS only | Configured |
| CNAME | `api.lumina` | `ad465d585e73ed72.vercel-dns-017.com` | DNS only | Configured |
| CNAME | `dev.lumina` | `f7a895aad2762b42.vercel-dns-017.com` | DNS only | Configured; Vercel valid |
| CNAME | `app.dev.lumina` | `7fba3fe690f6626f.vercel-dns-017.com` | DNS only | Configured; Vercel valid |
| CNAME | `api.dev.lumina` | `ad465d585e73ed72.vercel-dns-017.com` | DNS only | Configured; Vercel valid |

The Lumina deployment does not use `app.akhigbe.xyz` or `api.akhigbe.xyz`. Those non-Lumina aliases were removed from Vercel and Pxxl before this audit. The unrelated apex, `www`, and `portfolio` DNS records are outside this project and must not be deleted as part of a Lumina release.

If this zone is ever moved to Cloudflare, begin with the `api` record set to DNS-only. Enable proxying only after HTTPS, webhook delivery, client IP handling, and Vercel domain validation have all been retested.

DNS checks:

```bash
dig +short lumina.akhigbe.xyz CNAME
dig +short app.lumina.akhigbe.xyz CNAME
dig +short api.lumina.akhigbe.xyz CNAME
dig +short dev.lumina.akhigbe.xyz CNAME
dig +short app.dev.lumina.akhigbe.xyz CNAME
dig +short api.dev.lumina.akhigbe.xyz CNAME
```

Vercel may show Invalid Configuration while a future DNS change propagates. Use the project Domains page Refresh control after the records resolve publicly.

On 2026-07-29 Pxxl published all six Lumina records. Vercel reported Valid Configuration and HTTPS worked for the three production and three development custom domains.

## Environment variables

Add variables through the Vercel dashboard. Production uses the three production domains; Preview uses the three `*.dev.lumina.akhigbe.xyz` domains. API secrets are server-only, with independent JWT secrets and Neon connections for Production and Preview.

### Marketing project

| Variable | Secret | Production value/source | 2026-07-29 status |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | No | Canonical marketing URL | Production and Preview configured separately |
| `NEXT_PUBLIC_APP_URL` | No | Product app URL | Production and Preview configured separately |
| `NEXT_PUBLIC_API_URL` | No | API URL | Production and Preview configured separately |
| `NEXT_PUBLIC_CONTACT_EMAIL` | No | Approved public support address | Missing; current fallback is a placeholder |

Only `NEXT_PUBLIC_*` public configuration belongs here. Do not add database, JWT, Paystack secret, or Brevo secret variables.

### Product app project

| Variable | Secret | Production value/source | 2026-07-29 status |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | No | API URL | Production and Preview configured separately |
| `NEXT_PUBLIC_APP_URL` | No | Product app URL | Production and Preview configured separately |
| `NEXT_PUBLIC_MARKETING_URL` | No | Canonical marketing URL | Production and Preview configured separately |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | No | Paystack public key, only if client code begins using it | Not required by the current server-initialized checkout |

Do not put `PAYSTACK_SECRET_KEY` or any other server credential in this project.

### API project

| Variable | Secret | Required | 2026-07-29 status |
| --- | --- | --- | --- |
| `NODE_ENV` | No | Yes | Configured |
| `PORT` | No | No on Vercel | Vercel-managed |
| `DATABASE_URL` | Yes | Yes | Production and Preview configured with separate Neon branches |
| `JWT_ACCESS_SECRET` | Yes | Yes | Production and Preview configured independently |
| `JWT_REFRESH_SECRET` | Yes | Yes | Production and Preview configured independently |
| `PAYSTACK_SECRET_KEY` | Yes | Yes for payments/webhooks | Test credential configured for Production and Preview |
| `PAYSTACK_WEBHOOK_SECRET` | Yes | No for current Paystack implementation | Intentionally unset |
| `PAYSTACK_BASE_URL` | No | Optional | Configured |
| `FRONTEND_APP_URL` | No | Yes | Production and Preview configured separately |
| `MARKETING_SITE_URL` | No | Yes | Production and Preview configured separately |
| `API_PUBLIC_URL` | No | Yes | Production and Preview configured separately |
| `CORS_ORIGINS` | No | Yes | Production and Preview configured separately |
| `TRUST_PROXY` | No | Yes | Configured |
| `BREVO_API_KEY` | Yes | Only when email is implemented | Missing |
| `BREVO_FROM_EMAIL` | No | Only when email is implemented | Missing |
| `BREVO_SENDER_EMAIL` | No | Legacy/documented sender name | Missing |

Paystack signs webhook payloads with the account secret key. The current code verifies `x-paystack-signature` with `PAYSTACK_SECRET_KEY`; Paystack does not issue a separate webhook signing secret for this flow. Keep `PAYSTACK_WEBHOOK_SECRET` unset unless the code is intentionally changed to use it and the value matches provider semantics.

After any environment-variable change, redeploy the affected project. A setting change does not alter an already-built Next.js bundle.

## Neon production database

Observed Neon state on 2026-07-29:

- Project ID/slug: `raspy-recipe-28377895`
- Branches: `production` and persistent child branch `development`
- Database: `neondb`
- Region: AWS Europe Central 1 (Frankfurt)
- Plan: Free
- Compute: autoscaling from 0.25 to 2 CU; endpoint may become Idle
- Initial production schema state: `public` contained 0 tables
- Runtime strategy: pooled connection strings in Vercel; direct connections for migrations
- Vercel API `DATABASE_URL`: configured separately for Production and Preview

Use the pooled Neon connection string for the Vercel API runtime. Use a direct, non-pooled connection for migrations when practical. Both should require TLS (`sslmode=require`). Never print either URL.

The Frankfurt region is usable for this portfolio deployment, but the API function was observed in `iad1`. If latency becomes material, align database and compute regions in a later infrastructure change.

### Migration procedure

1. Confirm whether the target is a portfolio demo/staging database or a real production database.
2. Export the direct migration URL into a private shell session without echoing it.
3. From the repository root, run:

   ```bash
   pnpm db:migrate
   ```

4. Confirm the expected tables and Drizzle migration journal in Neon.
5. For existing data only, run the idempotent repair commands when needed:

   ```bash
   pnpm payments:reconcile-invoices
   pnpm receipts:backfill
   ```

6. For an explicitly designated demo/staging database only:

   ```bash
   pnpm db:seed
   ```

Never seed a real production database. On 2026-07-29:

- Production: `pnpm db:migrate` completed successfully. No production seed was run. Reconciliation/backfill were not needed because there was no existing production data.
- Development: `pnpm db:migrate` and `pnpm db:seed` completed successfully.
- Development repairs: invoice reconciliation scanned 15 invoices and corrected 1 status; receipt backfill scanned 10 successful payments and created 10 receipts.

This project has no automated down-migration command. Prefer forward-fix migrations. Any manual rollback must be reviewed, backed up, tested against a copy, and executed separately from a Vercel rollback.

## CORS and public URLs

Production origins:

```text
https://app.lumina.akhigbe.xyz
https://lumina.akhigbe.xyz
```

Development origins:

```text
https://app.dev.lumina.akhigbe.xyz
https://dev.lumina.akhigbe.xyz
```

The API must return `Access-Control-Allow-Origin` only for an allowed origin and may return `Access-Control-Allow-Credentials: true`. It must not use `*` with credentials.

Verification:

```bash
curl -i -X OPTIONS https://api.lumina.akhigbe.xyz/public/waitlist \
  -H 'Origin: https://lumina.akhigbe.xyz' \
  -H 'Access-Control-Request-Method: POST'

curl -i -X OPTIONS https://api.lumina.akhigbe.xyz/auth/login \
  -H 'Origin: https://app.lumina.akhigbe.xyz' \
  -H 'Access-Control-Request-Method: POST'

curl -i -X OPTIONS https://api.lumina.akhigbe.xyz/auth/login \
  -H 'Origin: https://untrusted.example' \
  -H 'Access-Control-Request-Method: POST'
```

The first two responses should echo the trusted Origin. The third must not.

## API routes to verify

| Purpose | Method and path |
| --- | --- |
| Health | `GET /health` |
| Waitlist | `POST /public/waitlist` |
| Public invoice | `GET /public/invoices/:token` |
| Mark invoice viewed | `POST /public/invoices/:token/view` |
| Initialize payment | `POST /public/invoices/:token/pay` |
| Verify callback fallback | `POST /public/invoices/:token/payments/:reference/verify` |
| Public receipt | `GET /public/receipts/:token` |
| Paystack webhook | `POST /payments/paystack/webhook` |

`GET /payments/paystack/webhook` should return 404 and must never expose provider debug data.

## Paystack

Use Paystack Test Mode for the portfolio deployment.

- Webhook URL: `https://api.lumina.akhigbe.xyz/payments/paystack/webhook`
- Callback pattern: `https://app.lumina.akhigbe.xyz/invoice/<public-token>?payment=callback&reference=<reference>`
- The backend constructs the callback per invoice from `FRONTEND_APP_URL`.
- The webhook handler uses the exact NestJS raw body and rejects missing or invalid signatures.
- The callback verification endpoint is a fallback; a browser redirect is never proof of payment.

The Paystack dashboard was inspected in Test Mode on 2026-07-29. Its callback fallback and webhook were updated to the production Lumina addresses above, and Paystack accepted the settings update. The backend still supplies the dynamic invoice callback URL per transaction. Paystack exposes one account-level Test Mode webhook URL, so it remains pointed at production; development callback verification can still be tested, but a development webhook test requires a temporary dashboard switch followed by restoration to production.

Manual test:

1. Activate Payment Setup for a demo organisation.
2. Create and send an invoice.
3. Open its public invoice URL.
4. Initialize and complete a Paystack test payment.
5. Confirm the browser returns to the invoice callback.
6. Confirm callback verification and/or `charge.success` webhook processing succeeds.
7. Confirm the payment becomes successful and invoice totals/status update.
8. Confirm one receipt is generated.
9. Confirm a duplicate webhook is idempotent.

If delivery fails, inspect Paystack delivery history and Vercel function logs. Record only the HTTP status, event type, reference suffix where necessary, and safe error summary. Never weaken signature verification or copy a raw provider payload into a ticket.

## Brevo

The repository does not currently implement email sending. Brevo is therefore a future integration, not a launch dependency. When implemented:

1. Verify a sender identity or sending domain in Brevo.
2. Configure `BREVO_API_KEY` only on the API project.
3. Configure the approved sender address variable used by the implementation.
4. Send only to controlled test recipients during QA.
5. Review Vercel logs for safe error summaries without message bodies or credentials.

## Vercel-hosted NestJS limitations

The current API is appropriate for:

- REST and auth endpoints
- Paystack webhooks and server-side verification
- Waitlist requests
- Bounded CSV exports
- Dashboard queries
- Public invoices and receipts
- Short request/response work

It is not appropriate for:

- BullMQ or other long-running queue processors
- Persistent background workers or in-process schedulers
- WebSocket/Socket.IO servers
- Long-running scraping or heavy media processing
- Persistent local file storage
- Unbounded exports or requests that depend on process memory surviving

If those requirements appear, use a separate worker/service such as Fly.io, Koyeb, Railway, paid Render, a VPS, or an external queue/worker platform. For this request/response and webhook-driven portfolio MVP, Vercel plus Neon is acceptable.

## Free-tier limitations

- Vercel Hobby has usage and concurrency quotas, deployment retention, and no production SLA. Function cold starts and plan limits can change.
- Neon Free can suspend idle compute, causing the first query to be slower. Storage, compute, branch, and data-transfer quotas apply.
- The observed Neon project allowed 10 branches and could scale only within its free compute range.
- Paystack test mode does not prove live settlement readiness or compliance approval.
- DNS and TLS issuance may take time after records change.
- Free Brevo quotas and sender restrictions apply if email is later enabled.

Check current provider dashboards before a launch because free-tier limits are provider-controlled.

## Deployment sequence

1. Merge validated repository changes.
2. Confirm all required API secrets are present in Vercel.
3. Confirm DNS is valid and TLS is issued.
4. Run `pnpm db:migrate` with the direct Neon migration URL.
5. Redeploy the API and verify health/CORS/logs.
6. Redeploy the product and marketing projects.
7. Verify canonical URLs and that no production page targets localhost.
8. Configure the Paystack test webhook.
9. Run the smoke test in [deployment-smoke-test.md](./deployment-smoke-test.md).
10. Run reconciliation/backfill only if existing records require them.

## CI/CD and environments

GitHub Actions validates both long-lived branches:

- Pull requests targeting `dev` or `main`
- Pushes to `dev` or `main`
- Node.js 24, locked pnpm install, lint, typecheck, test, and build
- Safe `.example.test` public URLs for CI builds; no provider secret is stored in GitHub
- Concurrency cancellation for superseded runs

Vercel remains the deployment system:

- `main` is the Production branch for all three projects.
- `dev` is a Preview branch for all three projects.
- The three production custom domains are attached to Production.
- The three development custom domains are attached to Preview branch `dev`.
- Preview API/database/JWT values are separate from Production.
- Vercel Authentication is disabled, so all three development domains are
  reachable by reviewers who are not members of the Vercel team.

Do not promote a Preview deployment to Production unless its commit is intended for `main` and the production environment variables have been reviewed.

## Rollback

### Application

1. Open the affected Vercel project and select the last known-good production deployment.
2. Use Instant Rollback or Promote only after confirming its commit and environment.
3. Verify custom domains, health, and the highest-risk flow after rollback.

### Environment variables

1. Restore the previous variable version/value through Vercel.
2. Redeploy; changing a variable alone does not rebuild the deployment.
3. Never paste the old or new value into a ticket.

### Database

- Do not assume an application rollback reverses a migration.
- Prefer backward-compatible expand/contract migrations and a forward fix.
- Restore from Neon history/backup or perform a reviewed manual correction only when data impact is understood.

### Payments

- Disable the organisation Payment Setup/payment account to stop new payment initializations.
- In an emergency, remove/rotate the backend Paystack credential and redeploy, understanding that webhook and verification processing will also stop.
- Keep public invoices readable where possible.

### Safe log inspection

Filter by deployment, route, status, and time. Summarize errors without copying database URLs, authorization headers, JWTs, full email addresses, account numbers, raw webhook bodies, or customer payloads.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Marketing canonical or Sign In points to localhost | Marketing env variables exist and a new production deployment was built after the change |
| Product login says `Failed to fetch` | `NEXT_PUBLIC_API_URL`, DNS/TLS, API health, and CORS |
| Waitlist returns 500 | API `DATABASE_URL`, migrations, `marketing_waitlist_entries`, and runtime logs |
| Public invoice/receipt returns 500 | Database connection and migrations |
| API health is 200 but data routes fail | Missing `DATABASE_URL` or unapplied migrations |
| Custom domain is invalid | Exact Pxxl record, public DNS propagation, and Vercel Refresh |
| Webhook returns 401 | Raw body, `x-paystack-signature`, test/live key mode, and backend credential |
| Webhook returns 500 | Database state, pending payment reference, and safe runtime log summary |
| First database request is slow | Neon compute waking from Idle |
| Build succeeds with wrong URLs | Confirm production env names and redeploy; repository guards should make missing production variables fail closed after this runbook change is deployed |

## 2026-07-29 launch QA

- Production marketing, product login, authenticated workspace routes, API
  health, production CORS, legal/SEO routes, and idempotent waitlist submission
  passed.
- Development marketing, demo login, dashboard, customers, invoices, payments,
  receipts, exports, audit logs, Payment Setup, public invoice, public receipt,
  API health, and restricted CORS passed.
- The development marketing deployment initially exposed a client-side missing
  URL error. Commit `4c712ef` changed public URL access to statically analyzable
  `NEXT_PUBLIC_*` references; the replacement Preview deployment is Ready and
  the public domain now renders without browser errors.
- The production database intentionally has no seeded invoice or receipt data,
  so production public invoice and receipt pages were not exercised.
- A complete Paystack checkout was not performed. The development demo payout
  setup is disabled, while the webhook and callback configuration were verified
  independently.

## Launch record

For each launch, record the commit, deployment IDs, migration filenames applied, commands run, smoke-test result, and rollback deployment IDs. Record variable names and status only—never values.
