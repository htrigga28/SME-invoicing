# T021 Release Checklist

Complete every item before promoting the T021 branch to production. Record
names, not secret values.

## Database

- [ ] `pnpm db:migrate` applied in order through `0018` on the target database.
- [ ] `communication_event_quarantine` exists and is empty of unresolved rows
  older than the current deploy (`resolved_at IS NULL` reviewed or empty).
- [ ] No `communications` rows remain with `provider = 'brevo'` (migration
  `0016` backfills branch-era rows; production never had them).

## Resend configuration

- [ ] `RESEND_API_KEY` set on the API project only.
- [ ] `RESEND_FROM_EMAIL` uses a verified Resend sender identity or domain.
- [ ] `RESEND_WEBHOOK_SECRET` set on the API project only (Svix signing
  secret for the production webhook endpoint).
- [ ] No `BREVO_*` variables remain in any environment.
- [ ] `LEGACY_REFRESH_BODY_ENABLED` is unset (defaults to disabled). Enable
  temporarily only with a recorded removal date.

## Webhook registration

- [ ] Production endpoint registered in Resend: `POST
  https://api.lumina.akhigbe.xyz/webhooks/resend`.
- [ ] Subscribed events: `email.sent`, `email.delivered`,
  `email.delivery_delayed`, `email.bounced`, `email.failed`,
  `email.complained`, `email.suppressed`.
- [ ] `GET /health` returns 200; `GET /health/ready` returns 200 with the
  database reachable.

## Live provider round trip (required before merge)

- [ ] Send an invoice to a controlled recipient; delivery state becomes
  `accepted` with a Resend email ID persisted.
- [ ] `email.delivered` webhook advances the timeline to delivered.
- [ ] A bounced test recipient advances the timeline to failed with a safe
  reason and no raw provider payload stored.
- [ ] A replayed webhook returns `duplicate` without changing state.

## Session and tenant behavior

- [ ] Login with one workspace lands directly; login with several shows the
  workspace chooser and persists nothing until a choice is made.
- [ ] Reload without a stored workspace shows the chooser (single workspace
  auto-continues) instead of silently loading the oldest workspace.
- [ ] Authenticated requests without `x-organisation-id` fail closed on
  business routes (reads and mutations).
- [ ] Stale workspace selection recovers via membership refresh with a
  bounded single retry.

## Refund behavior

- [ ] An overpayment refund against Paystack test mode stores provider evidence
  and keeps capacity accounting consistent.
- [ ] `POST /payments/:id/refunds/:refundId/reconcile` resolves an uncertain
  refund from authoritative provider state.

## Rollback constraints

- [ ] Migrations are forward-only; there is no down-migration command.
- [ ] Rolling back the API does not reverse applied migrations.
- [ ] Cookie-session rollback only reverts the session commit; financial and
  communication fixes are independent.
- [ ] If the provider contract fails in preview, disable the Resend
  configuration and preserve issued invoices, local attempts, and
  reconciliation evidence.

## Post-deploy monitoring

- [ ] Unresolved quarantine count query runs clean (see runbook).
- [ ] `needs_attention` refund count reviewed.
- [ ] `invoice_email_idempotency_conflict` audit entries reviewed (should be
  empty; any entry is a local invariant violation to investigate).
- [ ] Legacy refresh-body usage logs reviewed (should be empty by default).
