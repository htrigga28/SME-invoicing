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
| onboarding_completed_at | Nullable. Set when business profile setup is complete. |
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
| due_date | Due date. |
| subtotal_kobo | Server-calculated. |
| discount_kobo | Invoice-level discount. |
| tax_kobo | Invoice-level tax. |
| total_kobo | Server-calculated. |
| amount_paid_kobo | Recalculated from successful payments. |
| balance_due_kobo | Recalculated from total minus amount paid. |
| paid_at | Nullable. Set when invoice first becomes fully paid. |
| sent_at | Nullable. |
| viewed_at | Nullable. |
| cancelled_at | Nullable. |
| voided_at | Nullable. |
| created_at, updated_at | Timestamps. |

Constraints:

- Unique on `organisation_id + invoice_number`.
- `invoices.public_token` unique.

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
| created_at | Timestamp. |

### payments

| Column | Notes |
| --- | --- |
| id | Primary key. |
| organisation_id | References organisations. |
| invoice_id | References invoices. |
| customer_id | References customers. |
| provider | `paystack`. |
| provider_reference | Paystack reference. |
| status | PaymentStatus. |
| currency | Defaults to `NGN`. |
| amount_kobo | Integer kobo. |
| paid_at | Nullable. |
| created_at, updated_at | Timestamps. |

Constraint: unique on `provider + provider_reference`.

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
| payload_redacted | Redacted JSON payload. |
| processed_at | Nullable. |
| processing_error | Nullable safe error. |
| created_at | Timestamp. |

Constraint: prevent duplicate processing of the same provider event/reference. Use a unique key such as `provider + provider_event_id` when present, plus defensive uniqueness around processed `provider + provider_reference + event_type`.

### receipts

| Column | Notes |
| --- | --- |
| id | Primary key. |
| organisation_id | References organisations. |
| invoice_id | References invoices. |
| payment_id | References payments. |
| receipt_number | Organisation-scoped generated number. |
| amount_kobo | Integer kobo. |
| issued_at | Timestamp. |
| created_at, updated_at | Timestamps. |

Constraints:

- Unique on `organisation_id + receipt_number`.
- Unique on `payment_id`.

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
- Invoice `subtotal_kobo` is the sum of `invoice_line_items.line_total_kobo`.
- Invoice `total_kobo` is `subtotal_kobo - discount_kobo + tax_kobo`.
- Invoice `amount_paid_kobo` and `balance_due_kobo` are recalculated from successful payments.
- `paid_at` is set when an invoice first becomes fully paid.
- If a paid invoice later changes because of refund or future adjustment, treat that as future work for MVP. Refunds are represented as a payment status but are not fully implemented.

## Operational Notes

- Direct public registration creates a new user, organisation/workspace, Owner membership, and blank business profile in one transaction.
- Completing business profile marks organisation onboarding as complete.
- Cancelling invoices should preserve records and status events.
- Voiding invoices should be allowed for correction/error cases and retained for audit.
- Raw webhook events should be stored safely with sensitive fields redacted or encrypted where needed.
- Audit logs should capture significant changes without storing secrets.
