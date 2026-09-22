# Database Schema Plan

## General Rules

- Use UUIDs or cuid-style IDs consistently.
- Use integer kobo for all money fields.
- Default currency is `NGN`.
- Add `organisation_id` to all organisation-scoped tables.
- Use `created_at` and `updated_at` timestamps.
- Add `deleted_at` or `archived_at` only where needed.
- Do not store plaintext secrets or passwords.
- Do not expose sensitive webhook payload data in logs.

## Tables

### users

| Column | Notes |
| --- | --- |
| id | Primary key. |
| email | Unique, normalized. |
| password_hash | Required for password auth, never returned by APIs. |
| name | User display name. |
| created_at, updated_at | Timestamps. |

Constraint: `users.email` unique.

### refresh_tokens

| Column | Notes |
| --- | --- |
| id | Primary key. |
| user_id | References users. |
| token_hash | Hash of the refresh token. Raw refresh tokens must never be stored. |
| expires_at | Expiration timestamp. |
| revoked_at | Nullable revocation timestamp. |
| created_at, updated_at | Timestamps. |

Refresh tokens support `POST /auth/refresh` and `POST /auth/logout`. Rotation and revocation must compare hashes, not raw stored tokens.

### organisations

| Column | Notes |
| --- | --- |
| id | Primary key. |
| name | Internal workspace name, may default from business name/email. |
| slug | Unique workspace slug. |
| onboarding_completed_at | Nullable. Set when business profile setup is complete. Full signup completion is derived separately from payment-account history. |
| created_at, updated_at | Timestamps. |

Constraint: `organisations.slug` unique.

### organisation_members

| Column | Notes |
| --- | --- |
| id | Primary key. |
| organisation_id | References organisations. |
| user_id | References users. |
| role | `owner`, `admin`, `accountant`, `viewer`. |
| status | `active`, `suspended`, `removed`. |
| created_at, updated_at | Timestamps. |

Constraint: unique on `organisation_id + user_id`.

A user is not an organisation member until an invitation is accepted. Invitation lifecycle belongs only in `organisation_invitations.status`.

### organisation_invitations

| Column | Notes |
| --- | --- |
| id | Primary key. |
| organisation_id | References organisations. |
| email | Invited email. |
| token_hash | Unique hash of secure invitation token. |
| role | Role to grant on acceptance. |
| status | `pending`, `accepted`, `revoked`, `expired`. |
| invited_by_user_id | References users. |
| expires_at | Expiration timestamp. |
| accepted_at | Nullable acceptance timestamp. |
| revoked_at | Nullable revocation timestamp. |
| created_at, updated_at | Timestamps. |

Constraints:

- `organisation_invitations.token_hash` unique.
- Prevent duplicate pending invitations for the same organisation and email with a suggested partial unique constraint on `organisation_id + lower(email)` where `status = pending`.

Accepted, revoked, and expired historical invitations may remain for audit.

### business_profiles

| Column | Notes |
| --- | --- |
| id | Primary key. |
| organisation_id | References organisations. Unique. |
| business_name | Customer-facing business name. |
| email | Business contact email. |
| phone | Business contact phone. |
| address | Business address. |
| logo_file_id | Optional file reference. |
| setup_completed_at | Nullable. |
| created_at, updated_at | Timestamps. |

Constraint: `business_profiles.organisation_id` unique.

### organisation_payment_accounts

| Column | Notes |
| --- | --- |
| id | Primary key. |
| organisation_id | References organisations. |
| provider | `paystack`. |
| provider_subaccount_code | Nullable until subaccount creation succeeds. |
| bank_code | Provider bank code. |
| bank_name | Resolved bank name. |
| account_name | Provider-resolved and user-confirmed account name. |
| account_number_last4 | Masked last four digits only. |
| status | `pending_confirmation`, `active`, `verification_delayed`, `disabled`. |
| verified_at | Nullable activation/verification timestamp. |
| disabled_at | Nullable disable timestamp. |
| provider_metadata_redacted | Nullable JSONB with safe provider metadata only. |
| created_by_user_id | Nullable reference to the user who created the record. |
| created_at, updated_at | Timestamps. |

Rules:

- One active Paystack payment account per organisation.
- Do not store full account number after subaccount creation.
- Store only masked account details.
- `provider_subaccount_code` must be unique where present.
- Payment setup records are organisation-scoped.
- Disabled accounts remain for audit/history.
- Disabled accounts can be reactivated when they still have a stored `provider_subaccount_code`.
- Reactivation clears `disabled_at` and keeps the one-active-account-per-organisation/provider rule.
- Changing payout account should create or activate a new record and disable the prior active record, depending on the implementation path.

Indexes and constraints:

- Index on `organisation_id`.
- Index on `organisation_id + provider`.
- Index on `organisation_id + status`.
- Partial unique index on `provider_subaccount_code` where `provider_subaccount_code is not null`.
- Partial unique index on `organisation_id + provider` where `status = active`.

Storage and redaction:

- Full account numbers are request-time values only and must not be stored.
- Frontend responses expose only `account_number_last4`.
- Provider metadata is stored only as redacted JSONB and must not contain raw Paystack responses or account numbers.

### customers

| Column | Notes |
| --- | --- |
| id | Primary key. |
| organisation_id | References organisations. |
| name | Customer name. |
| email | Customer billing email. |
| phone | Optional. |
| billing_address | Optional. |
| created_by_user_id | Nullable reference to the user who created the customer. |
| archived_at | Nullable soft archive timestamp. |
| created_at, updated_at | Timestamps. |

Customers are organisation-scoped. Archived customers remain available for historical invoices, are excluded from the default active list, and are read-only in the MVP.

Indexes and constraints:

- Index on `organisation_id`.
- Index on `organisation_id + archived_at`.
- Index on `organisation_id + email`.
- Index on `organisation_id + name`.
- Partial unique index on `organisation_id + lower(email)` where `archived_at is null`.

Duplicate active customer emails are blocked within an organisation. Archived customers do not block creating a new active customer with the same email.

### catalogue_items

| Column | Notes |
| --- | --- |
| id | Primary key. |
| organisation_id | References organisations. Cascade on organisation deletion. |
| name | Required, trimmed, maximum 200 characters. |
| description | Optional, trimmed, maximum 2,000 characters. |
| default_unit_price_kobo | Required integer kobo from 0 through `2,147,483,647`. |
| archived_at | Nullable soft archive timestamp. Null means active. |
| created_by_user_id | Nullable reference to the user who created the item. Set null on user deletion. |
| created_at, updated_at | Timestamps. |

Catalogue items are organisation-scoped reusable products/services for invoice authoring. Archive replaces delete. Saved invoice lines are independent snapshots: selecting a catalogue item copies its name into the invoice description (500-character limit) plus quantity and price, and the saved invoice never reads live catalogue values.

Index: `catalogue_items_org_archived_at_idx` on `organisation_id + archived_at`.

### invoices

| Column | Notes |
| --- | --- |
| id | Primary key. |
| organisation_id | References organisations. |
| customer_id | References customers. |
| invoice_number | Organisation-scoped generated number. |
| public_token | Unique unguessable token. |
| public_access_enabled | Boolean. Required for public invoice lookup. |
| status | InvoiceStatus. |
| currency | Defaults to `NGN`. |
| issue_date | Invoice issue date. |
| due_date | Due date. Payment-term presets (Net 7/14/30, Custom) set this field; no separate term is stored. |
| customer_reference | Nullable customer-facing reference/PO number, maximum 120 characters. Cleared on duplication. |
| notes | Customer-facing memo, rendered on detail and the public invoice. |
| subtotal_kobo | Server-calculated. |
| discount_kobo | Invoice-level discount. |
| tax_kobo | Invoice-level tax. |
| total_kobo | Server-calculated. |
| amount_paid_kobo | Derived from payment/refund truth as net received. May exceed `total_kobo` when overpaid. |
| balance_due_kobo | Derived from invoice total minus net received, floored at zero. |
| paid_at | Nullable. Set when invoice first becomes fully paid. |
| sent_at | Nullable. |
| viewed_at | Nullable. First public-invoice view timestamp, preserved for compatibility. |
| last_viewed_at | Nullable. Most recent public-invoice view timestamp. |
| view_count | Integer, defaults to 0. Denormalized count of `invoice_view_events` rows. |
| cancelled_at | Nullable. |
| voided_at | Nullable. |
| created_at, updated_at | Timestamps. |

Constraints:

- Unique on `organisation_id + invoice_number`.
- `invoices.public_token` unique.
- Index organisation-scoped lookups by status, customer, due date, and created date.

### invoice_number_sequences

| Column | Notes |
| --- | --- |
| organisation_id | Primary key. References organisations. |
| next_number | Next invoice sequence number for the organisation. |
| updated_at | Timestamp. |

The API allocates invoice numbers server-side inside the invoice creation transaction. Numbers are scoped per organisation and formatted as `INV-000001`.

### invoice_line_items

| Column | Notes |
| --- | --- |
| id | Primary key. |
| organisation_id | References organisations. |
| invoice_id | References invoices. |
| description | Line item description. |
| quantity | `numeric(10,2)`. |
| unit_price_kobo | Integer kobo. |
| line_total_kobo | Server-calculated. |
| sort_order | Stable display order for invoice lines. |
| created_at, updated_at | Timestamps. |

Line item calculation:

```text
line_total_kobo = round(quantity * unit_price_kobo)
```

Server-side calculation is authoritative. MVP line items do not have per-line tax or per-line discount.

### invoice_status_events

| Column | Notes |
| --- | --- |
| id | Primary key. |
| organisation_id | References organisations. |
| invoice_id | References invoices. |
| from_status | Nullable for initial event. |
| to_status | New status. |
| reason | Machine-readable reason. |
| actor_user_id | Nullable for system/public events. |
| metadata_redacted | Optional JSON metadata that excludes sensitive raw provider payloads. |
| created_at | Timestamp. |

### communications

One row per invoice email send attempt (initial send or manual resend). Resends create new rows; history is never overwritten.

| Column | Notes |
| --- | --- |
| id | Primary key. |
| organisation_id | References organisations. |
| invoice_id | References invoices. Cascade on invoice deletion. |
| customer_id | References customers. |
| purpose | Currently `invoice_delivery`. Reserved for T022 reminder reuse. |
| channel | Currently `email`. |
| provider | Currently `resend`. |
| subject | Nullable email subject. |
| to_recipients | JSONB array of normalized recipient emails. |
| cc_recipients | JSONB array of normalized CC emails. |
| provider_message_id | Nullable Resend email ID. Unique where present. Backfilled monotonically: only when null or equal; a conflicting value goes to review. |
| provider_idempotency_key | Per-attempt UUID sent to Resend as the `Idempotency-Key` request option (retained 24 hours). Reused only when retrying a `pending`/`submission_uncertain` attempt on the same row with an identical payload. Indexed (non-unique, reuse is intentional). |
| retry_claim_token | Nullable atomic retry claimant token for same-row retries. |
| retry_claimed_at | Nullable claim timestamp; claims expire after a bounded lease longer than the Resend request timeout. |
| status | `pending`, `accepted`, `delivered`, `deferred`, `failed`, `submission_uncertain`, `in_progress`, `partially_failed`. The last three are derived/ambiguity states, documented below. |
| accepted_at | Nullable provider-acceptance timestamp. |
| delivered_at | Nullable delivery timestamp. |
| deferred_at | Nullable deferral timestamp. |
| failed_at | Nullable failure timestamp. |
| failure_reason | Nullable safe display reason. |
| created_by_user_id | Nullable reference to the sending user. |
| created_at, updated_at | Timestamps. |

Indexes: `organisation_id + invoice_id`; partial unique on `provider_message_id` where not null; index on `provider_idempotency_key`.

Delivery state semantics:

- `submission_uncertain` means the provider did not confirm receipt (timeout, network drop, 5xx, unreadable response). It is never recorded when the provider explicitly rejected the send, and it never overwrites an accepted send.
- `in_progress` and `partially_failed` are aggregates derived from `communication_recipients` (see below). Recipient rows are authoritative; the parent status converges to the same aggregate regardless of webhook arrival order.

### communication_recipients

One row per recipient (To/CC) of a communication, holding recipient-level delivery state. Recipient transitions use atomic conditional updates so concurrent webhook events cannot regress each other.

| Column | Notes |
| --- | --- |
| id | Primary key. |
| organisation_id | References organisations. |
| communication_id | References communications. Cascade on deletion. |
| invoice_id | References invoices. Cascade on deletion. |
| email | Normalized (lower-cased) recipient email. Unique per communication. |
| recipient_type | `to` or `cc`. |
| status | `pending`, `accepted`, `delivered`, `deferred`, `failed`. |
| accepted_at | Nullable acceptance timestamp. |
| delivered_at | Nullable delivery timestamp. |
| deferred_at | Nullable deferral timestamp. |
| failed_at | Nullable failure timestamp. |
| failure_reason | Nullable safe display reason. |
| created_at, updated_at | Timestamps. |

Indexes: `organisation_id + communication_id`; `organisation_id + invoice_id`; unique on `communication_id + email`.

Aggregate rules (parent `communications.status` derived from recipient rows; single-recipient sends collapse to the plain lifecycle):

- no recipients → `pending`;
- all `accepted` → `accepted`;
- all `delivered` → `delivered`;
- all `failed` → `failed`;
- any `failed` → `partially_failed`;
- any `deferred` → `deferred`;
- otherwise → `in_progress`.

### communication_events

Normalized provider webhook events. Raw payloads are never stored; only the event type, occurrence time, and safe metadata (recipient email) are persisted.

| Column | Notes |
| --- | --- |
| id | Primary key. |
| organisation_id | References organisations. |
| communication_id | References communications. Cascade on deletion. |
| invoice_id | References invoices. Cascade on deletion. |
| provider | Currently `resend`. |
| provider_event_key | Stable idempotency key (`resend:<svix message id>`). Unique; the Svix message id is the authoritative event identity. |
| event_type | Normalized provider event name. |
| occurred_at | Provider event timestamp. |
| metadata_redacted | Optional safe metadata only. |
| created_at | Timestamp. |

Indexes: `organisation_id + communication_id`; `organisation_id + invoice_id`.

### communication_event_quarantine

Authenticated Resend events that cannot yet be correlated to a communication (migration `0015`). Rows store only normalized routing fields — never raw payloads, secrets, subjects, or bodies — and cannot mutate delivery truth before exact correlation.

| Column | Notes |
| --- | --- |
| id | Primary key. |
| provider | Currently `resend`. |
| provider_event_id | Nullable authoritative Svix message id. |
| provider_event_key | Unique (`resend:<svix message id>`); conflict recovery keeps the first writer. |
| provider_message_id | Nullable Resend email ID for later message-ID matching. |
| correlation_communication_id | Validated Lumina communication UUID from the `lumina_communication` Resend tag, when present. |
| event_type | Normalized provider event name. |
| occurred_at | Provider event timestamp. |
| recipient_email | Normalized recipient email when present. |
| reason | Safe redacted quarantine reason. |
| resolved_communication_id | Nullable resolved communication; set with `resolved_at` when a later acceptance or webhook correlates exactly. |
| resolved_at | Nullable resolution timestamp. |
| created_at | Timestamp. |

Unique partial index on `(provider, provider_event_id)` where not null; indexes on `provider_message_id` and `correlation_communication_id` for resolution scans.

### invoice_view_events

One row per valid public-invoice page view. No IP address, device fingerprint, or user agent is collected.

First-view semantics are split across two transactions by design: the view
event, counters, and earliest/latest timestamps commit first; the `sent →
viewed` lifecycle flip commits second under a `status = 'sent'` CAS predicate.
A crash between the steps leaves view telemetry without the lifecycle event,
and the next view heals it (counters increment again, the flip is retried
idempotently). Counters may therefore exceed the lifecycle transition count by
the number of interrupted first views; financial state never depends on views.

| Column | Notes |
| --- | --- |
| id | Primary key. |
| organisation_id | References organisations. |
| invoice_id | References invoices. Cascade on deletion. |
| occurred_at | View timestamp. |
| source | Currently `public_invoice_page`. |
| created_at | Timestamp. |

Index: `organisation_id + invoice_id`.

### payments

Rows in `payments` represent Paystack checkout/payment attempts. They are not deleted when a customer retries checkout or when a later successful payment supersedes an older failed/pending/abandoned attempt.

| Column | Notes |
| --- | --- |
| id | Primary key. |
| organisation_id | References organisations. |
| invoice_id | References invoices. |
| customer_id | References customers. |
| provider | `paystack`. |
| provider_reference | Paystack reference. |
| provider_transaction_id | Nullable Paystack transaction ID captured on confirmation and used for refund reconciliation. |
| provider_subaccount_code | Nullable subaccount used during initialization for historical traceability. |
| provider_access_code | Paystack checkout access code returned at initialization. |
| provider_authorization_url | Paystack checkout URL returned at initialization. |
| status | PaymentStatus. |
| currency | Defaults to `NGN`. |
| amount_kobo | Integer kobo. |
| initialized_at | Timestamp for checkout initialization. |
| paid_at | Nullable. |
| failed_at | Nullable. |
| abandoned_at | Nullable. |
| channel | Nullable provider payment channel. |
| gateway_response | Nullable safe provider response summary. |
| metadata_redacted | Safe metadata only; no secrets or raw sensitive payloads. |
| created_at, updated_at | Timestamps. |

Constraints and indexes:

- Unique on `provider + provider_reference`.
- Index on `organisation_id + provider_subaccount_code`.
- Index on `organisation_id + status`.
- Index on `organisation_id + created_at` for the T013 payments list and summary views.
- Index on `provider + provider_reference` for webhook matching and detail lookups.

Subaccount traceability rules:

- Invoice payment records should store the `provider_subaccount_code` used during initialization.
- The column is nullable for older rows and payment attempts that predate subaccount-aware initialization.
- Webhook processing should reconcile by reference while preserving the subaccount context used when the payment started.
- T013 reconciliation views do not expose `provider_subaccount_code`; they show a safe settlement account summary by matching the stored code to `organisation_payment_accounts` inside the current organisation.
- Attempt state and reconciliation state are computed in service logic from payment status, invoice/customer ownership, invoice balance/status, payment events, and settlement account traceability. They are not stored as database columns.
- Superseded attempts remain stored for audit/support and are available through `GET /payments?view=all_attempts`, but they are hidden from the default reconciliation-focused view.

T008 creates the `payments` table and stores pending Paystack initialization records. It does not create `payment_events`, receipts, or invoice balance updates.

### payment_refunds

Rows in `payment_refunds` represent Paystack refund requests against successful payment attempts. Refunds are asynchronous provider records; a pending/processing refund does not reduce invoice paid totals until Paystack confirms it as processed.

| Column | Notes |
| --- | --- |
| id | Primary key. |
| organisation_id | References organisations. |
| payment_id | References payments. One payment can have multiple partial refunds. |
| provider | `paystack`. |
| provider_refund_id | Nullable Paystack refund identifier. |
| amount_kobo | Integer kobo. |
| currency | Defaults to `NGN`. |
| status | `pending`, `processing`, `needs_attention`, `processed`, `failed`. |
| reason | Required internal reason supplied by Owner/Admin. |
| customer_note | Nullable safe note sent to Paystack. |
| merchant_note | Nullable safe note sent to Paystack. |
| initiated_by_user_id | Nullable user reference. |
| processed_at | Nullable provider-processed timestamp. |
| failed_at | Nullable provider-failed timestamp. |
| needs_attention_at | Nullable provider-attention timestamp. |
| provider_metadata_redacted | Safe provider metadata only; no raw response, secrets, card data, or bank details. |
| created_at, updated_at | Timestamps. |

Constraints and indexes:

- Index on `payment_id`.
- Index on `organisation_id + status`.
- Unique on `provider + provider_refund_id` where `provider_refund_id is not null`.

Refund rules:

- Total requested non-failed refunds must not exceed the selected payment amount.
- Manual T013 refunds are limited to invoice overpayment resolution.
- Only processed refunds contribute to the derived invoice financial calculation.
- Pending/processing/needs-attention/failed refunds remain visible for resolution tracking.
- The app does not collect customer refund bank details in the MVP.

### payment_events

| Column | Notes |
| --- | --- |
| id | Primary key. |
| organisation_id | Nullable until matched, then set. |
| payment_id | Nullable until matched. |
| provider | `paystack`. |
| provider_event_id | Provider event identifier when available. |
| provider_reference | Payment reference. |
| event_type | Paystack event type. |
| signature_valid | Whether the webhook signature was valid. |
| processed | Whether processing or safe ignoring is complete. |
| duplicate_of_event_id | Nullable reference to the event this duplicate maps to. |
| payload_redacted | Redacted JSON payload. |
| processed_at | Nullable. |
| error_message | Nullable safe error or review reason. |
| created_at | Timestamp. |

Constraints and idempotency:

- Unique `provider + provider_event_id` when `provider_event_id` is present.
- Index provider, provider_reference, payment_id, organisation_id, event_type, and processed.
- Index on `organisation_id + processed` for the T013 review-events view.
- Processing also checks existing processed `provider + provider_reference + event_type` events to prevent double-counting when Paystack does not provide a reliable event ID.
- T013 exposes safe event summaries for reconciliation review only. Raw `payload_redacted` remains backend/internal data and is not returned by default.

Payment/refund financial truth:

- `payments.status = successful` contributes to gross received.
- `payment_refunds.status = processed` subtracts from gross received.
- Invoice `amount_paid_kobo`, `balance_due_kobo`, payment-derived status, and overpayment state are derived from those persisted records.
- Attempt state, reconciliation state, review state, and review resolution are computed service fields and are not stored as columns.

### receipts

| Column | Notes |
| --- | --- |
| id | Primary key. |
| organisation_id | References organisations. |
| payment_id | References payments. |
| invoice_id | References invoices. |
| customer_id | References customers. |
| receipt_number | Organisation-scoped generated number, for example `RCT-000001`. |
| public_token | Globally unique unguessable token for `/receipt/:token`. |
| public_access_enabled | Defaults true. |
| currency | Receipt currency, currently `NGN`. |
| amount_kobo | Original successful payment amount in kobo. Never changed by refunds. |
| payment_provider | Snapshot provider such as `paystack`. |
| payment_reference | Snapshot provider reference. |
| payment_channel | Nullable snapshot payment channel. |
| paid_at | Provider-confirmed payment timestamp. |
| issued_at | Receipt issuance timestamp. |
| business_name, business_email, business_phone, business_address | Business snapshot fields. |
| customer_name, customer_email, customer_phone, customer_billing_address | Customer snapshot fields. |
| invoice_number | Invoice number snapshot. |
| created_at, updated_at | Timestamps. |

Constraints:

- Unique on `organisation_id + receipt_number`.
- Unique on `payment_id`.
- Unique on `public_token`.
- Index `organisation_id`, `organisation_id + issued_at`, `organisation_id + customer_id`, `organisation_id + invoice_id`, and `payment_reference`.
- Receipts do not store `provider_subaccount_code`, payout bank details, full bank account numbers, raw Paystack responses, or Paystack secrets.

Receipt immutability:

- One successful payment has one receipt.
- One invoice can have multiple receipts through partial or duplicate successful payments.
- Snapshot fields are not rewritten when business, customer, invoice, payout account, or refund records change.
- Refund display is derived from `payment_refunds`, not stored by mutating the original receipt amount.

### receipt_number_sequences

| Column | Notes |
| --- | --- |
| organisation_id | Primary key and reference to organisations. |
| next_number | Next organisation receipt number. |
| updated_at | Timestamp. |

Receipt number generation is server-side, organisation-scoped, and uses the same transactional upsert pattern as invoice numbering.

### audit_logs

| Column | Notes |
| --- | --- |
| id | Primary key. |
| organisation_id | References organisations. |
| actor_user_id | Nullable for system/public events. |
| action | Machine-readable action. |
| entity_type | Entity type. |
| entity_id | Entity ID. |
| metadata_redacted | Safe metadata only. |
| created_at | Timestamp. |

Audit logs are append-only and read-only through the T016 UI. API and CSV export responses present sanitized metadata summaries/fields rather than arbitrary raw JSON. Sensitive keys such as password/token material, provider subaccount codes, public tokens, full account numbers, raw payloads, signatures, and organisation IDs must be excluded from audit-log responses and exports while safe masked fields such as `accountNumberLast4` may remain visible.

### files

| Column | Notes |
| --- | --- |
| id | Primary key. |
| organisation_id | References organisations where applicable. |
| storage_provider | Local/dev now, R2 later. |
| storage_key | Provider key. |
| file_name | Original file name. |
| mime_type | MIME type. |
| size_bytes | File size. |
| created_at, updated_at | Timestamps. |

## Required Relationships

- User can belong to many organisations through organisation_members.
- User has many refresh_tokens.
- Organisation has many organisation_members.
- Organisation has one business_profile.
- Organisation has many customers.
- Organisation has many invoices.
- Organisation has many payments.
- Organisation has many receipts.
- Organisation has many audit_logs.
- Customer belongs to one organisation.
- Customer has many invoices.
- Invoice belongs to organisation and customer.
- Invoice has many invoice_line_items.
- Invoice has many payments.
- Invoice has many invoice_status_events.
- Invoice has many communications.
- Invoice has many communication_events.
- Invoice has many invoice_view_events.
- Payment belongs to organisation, invoice, and customer.
- Payment can have one receipt.
- Receipt belongs to organisation, invoice, and payment.

## Number and Token Generation

- Invoice numbers should be generated server-side and scoped per organisation, for example `INV-000001`.
- Receipt numbers should be generated server-side and scoped per organisation, for example `RCT-000001`.
- Public invoice tokens must be cryptographically secure and unguessable.
- Raw invitation tokens must be shown only once and stored only as hashes.
- Public invoice lookup requires a valid `public_token`, `public_access_enabled = true`, and an invoice that is not `void`.

## Invoice Money Model

- MVP uses invoice-level `discount_kobo` and `tax_kobo`.
- Line items do not have per-line tax or per-line discount in MVP.
- Every persisted kobo value (catalogue price, unit price, discount, tax, line total, subtotal, total, paid, balance) must be an integer from 0 through `2,147,483,647` (`NGN 21,474,836.47`), the PostgreSQL signed-integer ceiling. Quantity must be greater than 0, at most `99,999,999.99`, with two decimals.
- Line items do not have per-line tax or per-line discount in MVP.
- Invoice `subtotal_kobo` is the sum of `invoice_line_items.line_total_kobo`.
- Invoice `total_kobo` is `subtotal_kobo - discount_kobo + tax_kobo`.
- Invoice `amount_paid_kobo` and `balance_due_kobo` are recalculated from successful payments.
- T008 payment initialization does not recalculate invoice money fields.
- T009 verified webhook processing recalculates invoice money fields from successful payments.
- `paid_at` is set when an invoice first becomes fully paid.
- If a paid invoice later changes because of refund or future adjustment, treat that as future work for MVP. Refunds are represented as a payment status but are not fully implemented.

## Operational Notes

- Direct public registration creates a new user, organisation/workspace, Owner membership, and blank business profile in one transaction.
- Completing business profile marks organisation onboarding as complete.
- Cancelling invoices should preserve records and status events.
- Voiding invoices should be allowed for correction/error cases and retained for audit.
- Raw webhook events should be stored safely with sensitive fields redacted or encrypted where needed.
- Audit logs should capture significant changes without storing secrets.

## T022 — Recurring billing & reminder automation (2026-09-22)

Africa/Lagos business-date semantics; one daily executor (Vercel Cron `0 8 * * *`, ~09:00 Lagos) via `GET /internal/automation/run` (CRON_SECRET, fail-closed, timing-safe Bearer check, no org ID from caller).

Tables: `automation_jobs` (generic ledger, UNIQUE idempotencyKey, statuses pending/running/completed/failed/needs_attention/skipped/cancelled, claimToken/claimedAt lease 10m, SKIP LOCKED batch 25, max 3 attempts); `recurring_invoice_schedules` + `recurring_invoice_schedule_line_items` (snapshot, not live catalogue) + `recurring_invoice_occurrences` (UNIQUE schedule+date, second defense); `organisation_reminder_settings` (OFF by default) + `reminder_steps` (one per relativeDays, -30..+60); `customers.automaticRemindersEnabled` + `invoices.automaticRemindersEnabled` (default true) + `invoices.scheduledSend{Date,To,Cc,Subject}`.

Recurrence anchor (no drift): weekly +7d; monthly/quarterly clamp to month length then return to anchor (Jan31→Feb28→Mar31); yearly preserves month/day (Feb29→Feb28 off-leap, back on leap). Resume advances to first occurrence on/after today; missed cycles skipped. End date completes schedule.

Reminders: effective rule org.enabled AND customer.opt-in AND invoice.opt-in; balance resolved at send time (partial → remaining); paid/cancelled/voided/non-public skip; latest applicable overdue step only; stale pre-due skipped. Templates allow {{businessName,customerName,invoiceNumber,amountDue,dueDate,publicInvoiceUrl}} only; values escaped; unknown rejected. Purpose `payment_reminder` reuses communications table + Resend provider + webhook correlation; uncertain submission → job needs_attention, never a fresh send.

Migration: `drizzle/0019_complex_jubilee.sql` (forward-only). Seed: active/paused/completed schedules, enabled reminder sequence, customer+invoice opt-outs, scheduled draft, completed + needs-attention jobs (no real email).
