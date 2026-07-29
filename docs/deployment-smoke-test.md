# Lumina Deployment Smoke Test

Run this checklist against controlled demo data after DNS, environment variables, migrations, and redeployments are complete. Do not put secrets, raw provider payloads, full bank account numbers, customer data, or public tokens into the test record.

## Preconditions

- [ ] Marketing, product, and API production deployments are Ready.
- [ ] Vercel custom domains show Valid Configuration and HTTPS is valid.
- [ ] API secrets are configured only on the API project.
- [ ] Neon migrations are applied to the intended production/demo database.
- [ ] The tester knows whether the database is demo/staging or real production.
- [ ] Paystack is in the intended test/live mode.
- [ ] A controlled demo user and invoice are available.

## Marketing

- [ ] `https://lumina.akhigbe.xyz` loads over HTTPS as the canonical marketing host.
- [ ] Desktop navigation works.
- [ ] Mobile navigation opens, links work, and closes correctly.
- [ ] Sign In opens `https://app.lumina.akhigbe.xyz/login`.
- [ ] Join Waitlist posts to `https://api.lumina.akhigbe.xyz/public/waitlist`.
- [ ] A valid controlled email returns the generic success state.
- [ ] Repeating the same email returns the same generic success state without a duplicate row.
- [ ] Honeypot behavior does not disclose anti-spam decisions.
- [ ] Implemented CTA source and UTM fields are persisted safely.
- [ ] No page source, link, form, or request targets localhost, `127.0.0.1`, or a preview URL.
- [ ] `<link rel="canonical">` and Open Graph URL use the canonical production URL.
- [ ] Open Graph image returns 200.
- [ ] `/robots.txt` returns 200 and references the production sitemap.
- [ ] `/sitemap.xml` returns 200 and contains production URLs.
- [ ] `/privacy` returns 200.
- [ ] `/terms` returns 200.
- [ ] Run Lighthouse where practical and record only category scores and actionable findings.

## Product app

- [ ] `/login` loads over HTTPS.
- [ ] Controlled demo login succeeds through the deployed API.
- [ ] Invalid credentials produce a safe error without provider or stack details.
- [ ] Dashboard loads.
- [ ] Payment Setup status loads.
- [ ] Customers list and a customer detail load.
- [ ] Invoices list and an invoice detail load.
- [ ] A public invoice link loads without authentication.
- [ ] Payments list and a payment detail load.
- [ ] Receipts list and a receipt detail load.
- [ ] A public receipt link loads without authentication.
- [ ] Exports work for an authorized role.
- [ ] Audit Logs work for an authorized role and are denied to a disallowed role.
- [ ] No request targets localhost, `127.0.0.1`, or a preview URL.
- [ ] UI/API responses do not expose `provider_subaccount_code`.
- [ ] UI/API responses show at most masked account digits, never a full account number.
- [ ] No frontend bundle or response contains server secrets.

## API

- [ ] `GET /health` returns 200 and a minimal safe body.
- [ ] HTTPS and HSTS are active.
- [ ] Product preflight echoes `https://app.lumina.akhigbe.xyz`.
- [ ] Marketing waitlist preflight echoes the canonical marketing origin.
- [ ] An untrusted Origin receives no `Access-Control-Allow-Origin`.
- [ ] Credentials are never combined with wildcard origin.
- [ ] Register/login/refresh/logout/current-user flows work as designed.
- [ ] `POST /public/waitlist` writes to Neon.
- [ ] `GET /public/invoices/:token` returns only intended public fields.
- [ ] `GET /public/receipts/:token` returns only intended public fields.
- [ ] `GET /payments/paystack/webhook` returns 404.
- [ ] A missing/invalid webhook signature is rejected.
- [ ] Runtime logs contain no secrets, database URLs, raw webhook bodies, or customer payloads.

## Database

- [ ] The Neon project, `production` branch, and `neondb` database are the intended targets.
- [ ] `public` schema contains the expected application tables.
- [ ] Drizzle migration journal contains the expected migrations.
- [ ] Application reads and writes succeed.
- [ ] No production deployment points at a local or development database.
- [ ] If demo/staging, seed was run intentionally and recorded.
- [ ] If real production, seed was not run.

## Paystack

- [ ] Platform test/live mode matches the deployment.
- [ ] A demo organisation has active Payment Setup.
- [ ] Payment initialization uses the organisation subaccount.
- [ ] Callback returns to the correct public invoice URL.
- [ ] Webhook URL is `https://api.lumina.akhigbe.xyz/payments/paystack/webhook`.
- [ ] `charge.success` is signature-verified using the exact raw body.
- [ ] Callback verification fallback works if the webhook is delayed.
- [ ] Payment reaches successful state once.
- [ ] Invoice amount paid, balance, and status update correctly.
- [ ] One receipt is generated.
- [ ] Repeated webhook/callback processing is idempotent.
- [ ] Paystack and Vercel logs show no unresolved delivery error.

## Security and data exposure

- [ ] `DATABASE_URL` exists only on the API project.
- [ ] JWT secrets exist only on the API project.
- [ ] Paystack secrets exist only on the API project.
- [ ] Brevo secret exists only on the API project if email is enabled.
- [ ] No `NEXT_PUBLIC_*` variable contains a secret.
- [ ] CSV exports omit public tokens, raw payloads, and provider subaccount codes.
- [ ] CSV cells are protected against spreadsheet formula injection.
- [ ] Logs and audit metadata are redacted.
- [ ] Payment Setup and payment UI show masked settlement details only.

## Migration and repair record

Record Yes/No, environment, operator, timestamp, and result without connection strings:

- [ ] `pnpm db:migrate`
- [ ] `pnpm db:seed` (demo/staging only)
- [ ] `pnpm payments:reconcile-invoices` (only when repair is required)
- [ ] `pnpm receipts:backfill` (only when historical successful payments need receipts)

## Development environment

Repeat the applicable checks above against:

- Marketing: `https://dev.lumina.akhigbe.xyz`
- Product app: `https://app.dev.lumina.akhigbe.xyz`
- API: `https://api.dev.lumina.akhigbe.xyz`
- Neon branch: `development`
- Git branch: `dev`

Development-specific checks:

- [ ] All three domains are attached to Vercel Preview branch `dev`.
- [ ] Development requests never use production API URLs.
- [ ] Development API never uses the production Neon branch.
- [ ] Seeded demo login works only against the development database.
- [ ] Development CORS echoes only the two development browser origins.
- [ ] Production and development JWT secrets are different.
- [ ] A development Paystack callback returns to `app.dev.lumina.akhigbe.xyz`.
- [ ] The account-level Paystack Test webhook is restored to the production API after any temporary development webhook test.
- [ ] No development hostname is used as a production canonical URL.

## Sign-off

- Commit:
- Marketing deployment:
- Product deployment:
- API deployment:
- Database classification (demo/staging/production):
- Paystack mode:
- Tester:
- Date/time:
- Result: Pass / Conditional pass / Fail
- Safe issue references:
- Rollback deployment IDs:
