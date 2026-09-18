# Lumina v2 — Codex Prompt: T021 Invoice Delivery, View Tracking & Unified Activity

**Status:** READY TO EXECUTE  
**Task:** T021  
**Branch:** `feat/t021-invoice-delivery-activity`  
**Base:** latest `dev` after PR #23

This is the next product task after:
- T020 Invoice Experience 2.0 (#21)
- App light-design overhaul (#22)
- MKT-01 Editorial Receivables marketing evolution (#23)

Do not begin another planning phase. Inspect the current implementation, make the smallest coherent domain additions, implement the vertical slice completely, validate it in the browser, and open one PR into `dev`.

---

# 1. Goal

Turn an invoice from a document with a manually toggled `sent` state into an **observable delivery lifecycle**.

A finance user should be able to answer, from the invoice detail page:

- Was the invoice actually issued?
- Who was it sent to?
- Did the email provider accept it?
- Was it delivered?
- Did delivery fail or get delayed?
- Has the customer opened the public invoice?
- How many times has the public invoice been viewed?
- What happened after that: payment started, payment confirmed, reconciliation, refund, receipt?
- What should I do next?

The result should feel like a natural continuation of the merged light Lumina workspace, not a bolt-on communications admin tool.

---

# 2. Required reading

Read before editing:

1. `docs/lumina-v2/00_BUILD_BRIEF.md`
2. `docs/lumina-v2/01_FEATURE_AND_BUILD_SEQUENCE.md`
3. `docs/lumina-v2/02_UI_UX_DIRECTION.md`
4. `docs/lumina-v2/03_CODEX_EXECUTION_GUIDE.md`
5. `docs/lumina-v2/06_APP_DESIGN_OVERHAUL.md`
6. `docs/lumina-v2/07_MOBBIN_APP_REFERENCE_LIBRARY.md`
7. `docs/design-system.md`
8. `docs/status-rules.md`
9. `docs/rbac-matrix.md`
10. `docs/database-schema.md`
11. `docs/api-contracts.md`

Then inspect the current code:

API:
- `apps/api/src/modules/invoices/invoices.service.ts`
- `apps/api/src/modules/invoices/invoices.controller.ts`
- `apps/api/src/modules/invoices/public-invoices.controller.ts`
- `apps/api/src/modules/invoices/invoice-status.ts`
- `apps/api/src/modules/payments/*`
- `apps/api/src/modules/receipts/*`
- `apps/api/src/modules/audit-log/*`
- `apps/api/src/database/schema.ts`
- `apps/api/src/database/seed.ts`
- `apps/api/src/config/env.validation.ts`

Web:
- `apps/web/src/features/invoices/invoice-detail-page.tsx`
- `apps/web/src/features/invoices/invoice-form-page.tsx`
- `apps/web/src/features/invoices/invoices-api.ts`
- `apps/web/src/features/invoices/types.ts`
- `apps/web/src/features/public-invoices/public-invoice-page.tsx`
- existing dialog/drawer/timeline/UI primitives.

---

# 3. Current-state audit — do not duplicate what already exists

The current implementation already has useful foundations.

## Existing send behavior

`InvoicesService.sendInvoice()` currently:

- accepts only draft invoices;
- enables public access;
- sets `sentAt`;
- changes invoice status to `sent`;
- writes the existing invoice status/audit transition;
- returns the public URL.

It does **not** send email today.

Treat the existing `sent` status as the invoice/document issuance state, not as proof of email delivery.

Do not overload invoice status with provider-delivery state.

## Existing public view behavior

There is already:

`POST /public/invoices/:token/view`

and:

`InvoicesService.markPublicInvoiceViewed()`.

Today it:

- transitions a persisted `sent` invoice to `viewed`;
- sets `viewedAt` once;
- writes invoice status/audit events.

This is only a first-view marker.

T021 must extend this instead of creating a second competing "viewed" mechanism.

## Existing activity UI

Invoice detail already renders an **Activity** block using `response.statusEvents`.

This currently shows invoice status transitions only.

T021 should evolve this into a real unified invoice timeline.

Do not create a second unrelated activity component and leave the old one beside it.

## Existing email configuration

Environment validation already recognizes:

- `BREVO_API_KEY`
- `BREVO_FROM_EMAIL`
- `BREVO_SENDER_EMAIL`

There is no transactional-email module/provider in the current API and no Brevo SDK dependency.

---

# 4. Brevo integration authority

Use current official Brevo transactional-email documentation.

Official send endpoint:
https://developers.brevo.com/docs/send-a-transactional-email

API reference:
https://developers.brevo.com/reference/send-transac-email

Transactional webhooks:
https://developers.brevo.com/docs/transactional-webhooks

Webhook creation/security reference:
https://developers.brevo.com/reference/create-webhook

Important provider facts to preserve:

- transactional email is sent through `POST /v3/smtp/email`;
- the response provides a provider `messageId`;
- delivery state should be updated from transactional webhooks;
- provider acceptance is not the same thing as inbox delivery;
- Brevo supports transactional delivery/failure event types.

## Implementation preference

Prefer a small internal `EmailProvider` / `BrevoEmailProvider` abstraction using the platform's existing `fetch` support rather than adding a large SDK dependency.

Reason:
- only a small provider surface is needed;
- the current API has no email SDK;
- it keeps T022 free to reuse the abstraction for reminders.

If the official Brevo package clearly produces a simpler and safer implementation after inspection, using it is acceptable, but explain why in the PR.

Do not scatter direct Brevo calls through invoice services.

---

# 5. Core domain decision

Separate these concepts:

```text
INVOICE STATUS
document / financial lifecycle

EMAIL DELIVERY
communication lifecycle

PUBLIC VIEW
customer opened the Lumina invoice URL
```

They are related but are not the same state machine.

Examples:

- An invoice may be `sent` while an email delivery failed.
- Brevo may report `delivered` while the customer has not opened the Lumina public invoice.
- An email open event must NOT automatically mark the Lumina invoice as `viewed`.
- A customer may open a paid invoice again; that must not regress the invoice's financial status.

---

# 6. Add a minimal Communications domain

T021 is immediately followed by T022 reminder automation, so do not build invoice-email storage that has to be deleted one task later.

Add a **small general-purpose communications module**, but implement email/invoice-delivery only.

Suggested module:

`apps/api/src/modules/communications/`

Suggested responsibilities:

- provider abstraction;
- Brevo adapter;
- create/send communication;
- provider webhook handling;
- recipient normalization;
- delivery/event persistence.

Do not build:
- SMS;
- WhatsApp;
- reminder rules;
- templates UI;
- campaign management;
- queues/workers;
- scheduled delivery.

Those belong later.

---

# 7. Suggested data model

Inspect the current schema and adjust naming if necessary, but preserve this shape.

## `communications`

Recommended fields:

- `id`
- `organisationId`
- `invoiceId`
- `customerId`
- `purpose` — currently `invoice_delivery`
- `channel` — currently `email`
- `provider` — `brevo`
- `subject`
- `toRecipients` JSONB
- `ccRecipients` JSONB
- `providerMessageId` nullable/indexed
- `status`
- `acceptedAt`
- `deliveredAt`
- `deferredAt`
- `failedAt`
- `failureReason` nullable and safe for display
- `createdByUserId`
- timestamps

Recommended high-level status values:

- `pending`
- `accepted`
- `delivered`
- `deferred`
- `failed`

Do not expose every provider-specific event as the top-level communication status.

## `communication_events`

Recommended fields:

- `id`
- `organisationId`
- `communicationId`
- `invoiceId`
- `provider`
- `providerEventKey` unique/idempotency key
- `eventType`
- `occurredAt`
- `metadataRedacted`
- `createdAt`

Persist normalized provider events, not a large unfiltered raw webhook payload.

## `invoice_view_events`

Recommended fields:

- `id`
- `organisationId`
- `invoiceId`
- `occurredAt`
- `source` = `public_invoice_page`

Do not collect IP address, device fingerprint, or user agent for this task.

## Invoice snapshot fields

Keep existing `viewedAt` as the first-view timestamp for compatibility.

Add, if useful:

- `lastViewedAt`
- `viewCount`

These may be denormalized summaries derived while inserting view events.

Document the meaning clearly.

---

# 8. Public view tracking behavior

Extend the existing `markPublicInvoiceViewed()`.

Required behavior:

1. Validate the public invoice/token using the existing security path.
2. Record a view event for a valid accessible public invoice.
3. On first eligible view:
   - preserve current `sent → viewed` transition behavior where valid;
   - set the existing first-view timestamp.
4. Update last-view/count without regressing invoice status.
5. A view of:
   - `viewed`
   - `partially_paid`
   - `paid`
   - overdue display state
   must never change the invoice back to another status.
6. Repeated views should remain useful but not make the UI noisy.

## Timeline presentation

Prefer summarizing repeated views as:

`Viewed 4 times · first Sep 18, 10:12 · last Sep 19, 08:44`

rather than rendering 40 identical timeline rows.

The underlying events should still exist.

---

# 9. Initial send flow

The current Send action must become a real email-delivery flow.

## UI

When a user chooses **Send invoice** or **Save and send**, open a send dialog.

Fields:

### To
Default:
- customer's current email.

Editable:
- yes, but prefilled.

### CC
Optional.
Allow multiple valid email addresses.

Do not add BCC in T021.

### Subject
Use a safe default and either:
- keep it fixed for T021; or
- make it editable only if the implementation remains simple.

Recommended default:

`Invoice {invoiceNumber} from {businessName}`

## Validation

- normalize/trims emails;
- lower-case for deduplication;
- reject invalid addresses;
- dedupe To/CC;
- enforce a sensible small recipient maximum;
- at least one To recipient;
- never trust frontend validation alone.

---

# 10. Send semantics

Use this separation:

## Invoice issuance

Issuing the invoice:

- enables public access;
- changes draft → sent;
- sets sentAt;
- remains the invoice lifecycle transition.

## Email delivery

After/with issuance:

- create a communication record;
- attempt provider send;
- persist Brevo messageId if accepted;
- update communication to accepted;
- later webhook updates delivery/deferred/failure state.

## Failure rule

If email transmission fails after the invoice has been issued:

- do NOT silently revert or mutate invoice status;
- the invoice remains issued/public;
- mark the communication failed;
- return a structured partial-success response;
- UI should say clearly:

`Invoice issued, but the email could not be sent. Copy the public link or try again.`

This is more honest than pretending the document itself was never issued.

Do not overload invoice status with `email_failed`.

---

# 11. Resend

Add a manual **Resend email** action.

Recommended endpoint:

`POST /invoices/:id/resend`

or a clean communications-oriented equivalent if the controller design is better.

Rules:

- creates a NEW communication attempt;
- does not overwrite the old delivery record;
- old failures/deliveries remain in history;
- does not change invoice financial status;
- defaults to current customer email but lets the user edit To/CC;
- permission should match invoice-management roles;
- disabled for inaccessible/cancelled/voided situations if current domain rules require it.

Do not make retries invisible.

---

# 12. Email content

Send a professional transactional invoice email.

Minimum content:

- business name;
- customer name;
- invoice number;
- amount due;
- due date;
- concise message;
- CTA to the public invoice URL;
- plain-text fallback.

Suggested CTA:

`View invoice`

Do not attach a PDF in T021 unless the repository already has a safe, implemented PDF pipeline. It currently does not need one.

## Sender

Use the verified Brevo sender configured by environment.

Sender display name may use:

`{businessName} via Lumina`

if compatible with the verified sender configuration.

Use the business-profile email as `replyTo` when present and valid.

## Security

Escape all user/business/customer-provided values inserted into generated HTML.

Never interpolate unescaped:
- business name;
- customer name;
- notes;
- subject;
- reference fields.

Do not include internal notes/audit/payment metadata in email.

---

# 13. Brevo webhook

Add one dedicated public webhook endpoint.

Suggested:

`POST /webhooks/brevo/transactional`

or equivalent.

## Security

Add:

`BREVO_WEBHOOK_SECRET`

Configure Brevo to send a custom secret header if supported by the final webhook configuration.

Validate it before processing.

Do not log the secret.

Do not trust arbitrary public payloads.

If implementation uses a different Brevo-supported webhook-auth method, document it.

## Idempotency

Webhook replay must be safe.

Use a stable `providerEventKey` derived from provider event identity.

Repeated webhook delivery:
- must not create duplicate communication events;
- must not repeatedly change timestamps incorrectly;
- must not throw 500 for already-processed events.

## Map provider events

At minimum support the delivery/failure states relevant to T021:

- provider sent/request accepted → accepted where appropriate;
- delivered → delivered;
- deferred / soft bounce → deferred;
- hard bounce → failed;
- blocked → failed;
- invalid → failed;
- provider error → failed.

Email-open tracking is NOT the same as public invoice viewing.

Do not mark the invoice `viewed` from Brevo open events.

You may ignore open/click events for T021 or store them as communication events without changing invoice view state.

---

# 14. Unified invoice activity API

Add a clean authenticated activity query.

Recommended:

`GET /invoices/:id/activity`

It should aggregate existing authoritative records rather than copying every event into a new master table.

Potential sources:

- invoice status events;
- safe invoice audit actions for created/edited/issued events;
- communications + communication events;
- invoice view events;
- payments/payment events;
- reconciliation state/events;
- refund events;
- receipts.

## Normalize into one response

Suggested shape:

```ts
type InvoiceActivityItem = {
  id: string;
  type:
    | "invoice_created"
    | "invoice_edited"
    | "invoice_sent"
    | "email_accepted"
    | "email_delivered"
    | "email_deferred"
    | "email_failed"
    | "invoice_viewed"
    | "payment_started"
    | "payment_confirmed"
    | "reconciliation_matched"
    | "reconciliation_review"
    | "refund_requested"
    | "refund_processed"
    | "receipt_issued"
    | "invoice_cancelled"
    | "invoice_voided";
  occurredAt: string;
  title: string;
  detail?: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  actor?: { id?: string; name?: string } | null;
  metadata?: Record<string, safe-display-value>;
};
```

Exact implementation may differ.

Requirements:

- reverse chronological for normal detail-page display, unless the existing UX clearly favors chronological;
- stable IDs;
- no raw provider metadata;
- no secret/internal audit fields;
- no full bank account data;
- no webhook payload dump.

## View summary

Repeated public view events may be collapsed into one activity item with:
- count;
- first viewed;
- last viewed.

---

# 15. Internal timeline is NOT the audit log

Keep these separate.

## Invoice activity

Purpose:
- understand the customer/document/payment lifecycle.

Readable to normal invoice viewers according to current RBAC.

## Audit log

Purpose:
- security/accountability/internal system actions.

Owner/Admin restrictions remain.

Do not expose audit-only metadata in the invoice activity timeline.

Do not delete or weaken existing audit events.

---

# 16. Invoice detail UX

Replace/evolve the current status-only Activity block.

## Desktop

Use a clear **Activity** or **Timeline** section.

Each row should have:

- icon/dot;
- human-readable title;
- concise detail;
- timestamp;
- optional status/tone.

Examples:

```text
Invoice created
Sep 18 · 09:14

Invoice emailed to accounts@northstar.example
Accepted by email provider · Sep 18 · 09:18

Email delivered
Sep 18 · 09:18

Invoice viewed
4 views · first 09:26 · last Sep 19 08:44

Payment started
₦78,400 · Sep 19 · 08:51

Payment confirmed
T8129-4F3A-90LX · Sep 19 · 08:52

Payment matched
Balance ₦0 · Sep 19 · 08:52

Receipt issued
RCT-000241 · Sep 19 · 08:52
```

Do not show raw enum transitions such as:

`sent → viewed`

as the primary user language.

## Delivery summary

Near invoice actions/context, show the latest email delivery state separately from invoice status:

- Not emailed
- Sending / Accepted
- Delivered
- Delayed
- Failed

This should not replace the invoice status badge.

---

# 17. Send/resend UX states

Design all of these:

- sending;
- provider accepted;
- delivered;
- deferred;
- failed;
- resend in progress;
- resend successful;
- invoice issued + email failed partial success;
- email provider not configured;
- validation error;
- unauthorized role.

A failed email must have an obvious next action:
- Retry/resend;
- Copy public link.

---

# 18. Form flow change

Current T020 `Save and send` immediately calls existing send behavior.

Change it.

Recommended behavior:

1. save/create draft;
2. open the send dialog for the newly saved invoice;
3. user confirms To/CC;
4. issue + email;
5. navigate to detail and show delivery result.

Do not make users re-enter invoice fields.

If this becomes technically awkward, a flow that saves then navigates to detail with the send dialog open is acceptable and may be cleaner.

---

# 19. RBAC

Use the current role matrix.

Recommended:

Owner/Admin/Accountant:
- issue/send;
- resend.

Viewer:
- read invoice/activity;
- cannot send/resend.

Do not introduce a new permission system.

Public customer:
- can view only the public invoice;
- cannot see internal communication/activity data.

---

# 20. Tenant isolation

Every communication/view/activity query must be organisation scoped internally.

Brevo webhook mapping by provider message ID must still resolve to a communication containing its owning organisation.

Never accept organisation ID from webhook input as authority.

Cross-tenant invoice IDs, communication IDs, or provider references must not disclose records.

Add tests.

---

# 21. Brevo configuration UX

The repository already permits missing Brevo values.

Do not make local development impossible.

If email configuration is absent:

- invoice issuance/public-link behavior should still work;
- actual email delivery should return a clear configuration-unavailable result;
- UI should present:
  `Email delivery is not configured. The invoice is issued and the public link can still be shared.`

Do not fake a successful delivery.

Document required deployment variables.

Production hard enforcement can be revisited in T019 launch hardening if current deployment does not yet have sender configuration.

---

# 22. Do not build T022 early

Explicitly out of scope:

- scheduled reminders;
- reminder templates UI;
- recurring invoices;
- cron;
- queues/workers;
- Postgres job runner;
- WhatsApp;
- SMS;
- collection sequences;
- promise to pay.

The Communications foundation should be reusable by T022, but T021 should remain immediate/manual delivery only.

---

# 23. Demo/seed data

Update seed data so T021 is visible immediately.

Include examples such as:

1. Invoice delivered and viewed multiple times.
2. Invoice email accepted but not yet viewed.
3. Invoice email failed/bounced.
4. Paid invoice with complete timeline through receipt.

Do not require real Brevo calls during seed.

Seed provider IDs should clearly be demo/test values.

---

# 24. Tests — API

Add focused tests for:

## Email send
- initial send issues invoice;
- communication record created;
- provider messageId stored;
- recipients normalized;
- CC stored;
- HTML values escaped;
- provider failure creates failed communication;
- invoice remains issued on post-issuance email failure;
- missing configuration gives controlled result.

## Resend
- creates new communication;
- preserves old attempt;
- correct permissions;
- invalid invoice states handled.

## Webhook
- secret required;
- delivered mapping;
- deferred mapping;
- failed mapping;
- unknown message ID handled safely;
- duplicate webhook event is idempotent;
- webhook never trusts tenant ID from payload.

## Views
- first view preserves current sent→viewed semantics;
- subsequent view increments summary;
- paid/partial/overdue/cancelled behavior does not regress status;
- inaccessible public invoice remains inaccessible.

## Activity
- merges sources in correct order;
- strips sensitive metadata;
- collapses view summary if designed that way;
- tenant isolation;
- viewer read access according to RBAC.

---

# 25. Tests — web

Add tests for:

- Send invoice dialog defaults to customer email.
- To/CC validation.
- Save and send enters delivery flow.
- Partial success: invoice issued, email failed.
- Resend action.
- Delivery badge/state.
- Unified timeline rendering.
- Repeated view summary.
- Mobile send dialog.
- Viewer role cannot send/resend.
- Existing copy-public-link path remains available.

Do not assert brittle styling classes.

---

# 26. Browser QA

Use browser/computer-use tooling.

Inspect at:

- 1440 desktop;
- 1280 laptop;
- 768 tablet;
- 390 mobile.

Required scenarios:

1. Draft invoice → Send.
2. Default To recipient.
3. Add CC.
4. Successful provider acceptance.
5. Delivery status.
6. Email failure + resend.
7. Copy public link fallback.
8. Viewed invoice with repeated views.
9. Paid invoice complete activity timeline.
10. Viewer/read-only role.

Check:

- no action collisions with current invoice detail layout;
- long recipient emails;
- long business/customer names;
- large NGN amounts;
- timeline remains scannable;
- mobile dialog usable;
- no page-level horizontal overflow.

---

# 27. Documentation

Update, where affected:

- `docs/api-contracts.md`
- `docs/database-schema.md`
- `docs/status-rules.md`
- `docs/rbac-matrix.md`
- `docs/deployment-plan.md` or current deployment/environment documentation
- `docs/codex-task-board.md`

Document:

- communication state vs invoice state;
- public view semantics;
- webhook security/idempotency;
- Brevo environment variables;
- activity endpoint.

Do not rewrite unrelated old docs.

---

# 28. Validation commands

Run at minimum:

```bash
pnpm --filter @sme-invoicing/api lint
pnpm --filter @sme-invoicing/api typecheck
pnpm --filter @sme-invoicing/api test

pnpm --filter @sme-invoicing/web lint
pnpm --filter @sme-invoicing/web typecheck
pnpm --filter @sme-invoicing/web test

pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run relevant E2E where the environment supports it.

Do not claim E2E passed if the required database/browser environment is unavailable.

---

# 29. PR requirements

Branch:

`feat/t021-invoice-delivery-activity`

Suggested title:

`T021: Add invoice delivery tracking and unified activity`

PR description must include:

- schema/migration summary;
- send semantics;
- Brevo integration;
- webhook security;
- view-tracking semantics;
- activity-source aggregation;
- RBAC/tenant isolation;
- screenshots/browser QA;
- validation commands;
- environment variables;
- known limitations.

---

# 30. Completion standard

T021 is complete when this story works:

```text
Create invoice
→ Save and send
→ confirm To / optional CC
→ invoice becomes issued/public
→ Brevo accepts email
→ delivery state becomes delivered (or failure remains visible)
→ customer opens public invoice
→ first/last view + count update
→ customer starts payment
→ payment confirms and reconciles
→ receipt is issued
→ one readable invoice Activity timeline explains the entire lifecycle
```

The user should no longer need to infer "sent" from a status badge or hunt across Payments, Audit Logs, and Receipts to understand what happened to an invoice.

Proceed with implementation now.
