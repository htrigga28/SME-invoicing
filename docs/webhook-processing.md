# Webhook Processing

Paystack webhook handling must be secure, idempotent, and safe when Paystack retries events.

T008 creates pending Paystack payment records during checkout initialization. T012 makes that initialization organisation-subaccount-aware by storing the Paystack `provider_subaccount_code` used for checkout. T009/T013 treat verified webhooks and server-side verification as provider truth for changing payment status, invoice balances, invoice status, and refund state. T014 adds receipt generation after successful reconciliation.

## Required Rules

- Paystack webhook signature verification is mandatory.
- Raw request body must be available for signature verification.
- Invalid signatures must be rejected.
- Invalid webhook attempts should be logged safely.
- Valid events must be stored.
- Duplicate events must be idempotent.
- Duplicate Paystack references must not double-count payments.
- Successful payments must update payment status.
- Successful payments must recalculate invoice `amount_paid_kobo` and `balance_due_kobo` from payment/refund truth.
- Successful payments must update invoice status.
- Successful payments must not generate receipts until T014.
- Successful payments should preserve the `provider_subaccount_code` used during initialization for traceability.
- Newly initialized payment records retain the organisation payment account `provider_subaccount_code`; webhook processing preserves that stored value rather than deriving it from webhook payloads.
- Failed payments must be recorded without marking invoice paid.
- Refund webhooks must update `payment_refunds` and only processed refunds may reduce net paid totals.
- Webhook processing should be safe if Paystack retries the same event.

## Processing Flow

1. Receive webhook with raw body.
2. Verify signature.
3. Extract event type and payment reference.
4. Store event with redacted payload.
5. Check if event/reference was already processed.
6. Find matching payment or refund context.
7. Verify amount, currency, and stored payment context.
8. Update payment or refund status.
9. Recalculate invoice payment totals when money truth changes.
10. Update invoice status.
11. Write audit log.
12. Mark event processed.

T014 generates receipts after successful payment reconciliation through the shared webhook/verification path.

## Signature Verification

- Use the raw request body exactly as received.
- Reject requests with missing or invalid Paystack signature headers.
- Do not parse and reserialize the body before verification.
- Log invalid attempts without storing secrets or full sensitive payloads.

## Idempotency

Use database constraints and transaction boundaries to make processing idempotent.

Idempotency keys include:

- Provider name.
- Provider event ID where available.
- Provider payment reference.
- Event type.

Rules:

- A duplicate event must not create a second successful payment.
- A duplicate payment reference must not add to `amount_paid_kobo` twice.
- A duplicate successful event must not create duplicate invoice status events.
- A duplicate successful event must not create duplicate receipt work in later tasks.
- Processing should be safe to retry after transient failure.
- When Paystack does not provide a reliable event ID, `provider + provider_reference + event_type` is the defensive idempotency key.

## Payment Matching

Match incoming events to a pending payment by:

- `provider = paystack`.
- `provider_reference`.
- Expected `amount_kobo`.
- Expected `currency = NGN`.
- Preserve the `provider_subaccount_code` stored at initialization time for historical context, even if webhook matching remains reference-driven.

If the webhook arrives before the frontend callback, the webhook remains the source of truth. The pending payment created during initialization should still be found by reference.

## Refund Matching

T013 supports minimal Paystack excess-refund tracking for overpayments. Refund events handled:

- `refund.pending`
- `refund.processing`
- `refund.needs-attention`
- `refund.failed`
- `refund.processed`

Refund events are matched first by Paystack refund ID when present, then defensively by the original transaction reference. Processing rules:

- `pending` and `processing` update refund status only.
- `needs_attention` keeps the overpayment review open and tells Owner/Admin to resolve through Paystack/provider workflow.
- `failed` keeps the overpayment review open.
- `processed` sets `processed_at`, recalculates invoice financial truth, and resolves overpayment review if excess becomes zero.
- Duplicate refund events must not subtract refunded amounts twice.

T013 reads `payments`, `payment_refunds`, and `payment_events` to show reconciliation visibility. The payments UI shows provider references, invoice/customer matches, computed reconciliation/review state, safe event summaries, refund state, and masked settlement account details where the stored subaccount code matches an organisation payment account. It must not expose raw webhook payloads or `provider_subaccount_code`.

T013 also adds a server-side Paystack Verify Transaction fallback after the customer returns from Paystack. The public callback endpoint verifies that the reference belongs to the invoice token, calls Paystack from the backend, validates reference, amount in kobo, and currency, and then uses the same idempotent reconciliation service as the `charge.success` webhook. The frontend callback is never proof of payment.

For local development, Paystack cannot deliver webhooks to a localhost-only URL. Use a public tunnel or deployed test backend URL in Paystack Test Mode. Valid webhook logs should include only safe structured fields such as provider, event type, provider reference, whether the signature was valid, whether a payment matched, and the processing result.

## Edge Cases

| Edge case | Behaviour |
| --- | --- |
| Invalid signature | Reject, log safe metadata, do not process. |
| Missing reference | Store safe event/error if signature is valid, mark unprocessed, do not mutate invoices. |
| Unknown invoice/payment | Store event, mark for review, do not create paid invoice state. |
| Duplicate event | Return success response, do not reprocess. |
| Duplicate reference | Do not double-count. Link to existing payment where safe. |
| Amount mismatch | Mark event for review, do not mark invoice paid automatically. |
| Currency mismatch | Mark event for review, do not mark invoice paid. |
| Invoice already paid | Store event, do not over-credit silently; flag for review if amount is new. |
| Invoice cancelled/void | Store payment truth, do not move invoice to paid automatically, write audit log. |
| Partial payment | Update invoice to `partially_paid`; T014 issues a separate receipt for the successful partial payment. |
| Overpayment | Mark invoice `paid`, balance `0`, and show Needs Review until excess is resolved. |
| Refund pending/processing | Store refund state; do not reduce invoice paid totals yet. |
| Refund needs attention | Keep review open and show safe provider-action-required state. |
| Refund failed | Keep review open; allow Owner/Admin to retry a valid excess refund. |
| Refund processed | Subtract processed refund once and recalculate invoice financial state. |
| Webhook before callback | Process webhook normally if pending payment reference exists. |
| Callback before webhook | Backend verification may reconcile first; the later webhook must be idempotent and must not double-count. |

## Receipt Generation

T014 receipt generation runs after a successful payment is persisted and invoice financial state is recalculated in the shared successful-payment reconciler used by both `charge.success` webhooks and server-side Verify Transaction fallback.

Receipt rules:

- Generate one immutable receipt per successful payment.
- Enforce uniqueness on `receipts.payment_id`.
- Duplicate webhook and repeated verification processing must not create duplicate receipts.
- Successful payments against cancelled or void invoices still receive receipts because money moved; the reconciliation review state remains responsible for the invoice anomaly.
- Receipt creation must not mutate payment status, invoice financial truth, or refund status.
- If a historical successful payment has no receipt, run `pnpm receipts:backfill` to create the missing receipt idempotently.

## Audit Logging

Write audit logs for:

- Successful payment reconciliation.
- Failed payment event.
- Duplicate ignored event.
- Amount or currency mismatch.
- Cancelled/void invoice payment arrival.
- Refund initiated, failed submission, and processed refund recalculation.

Audit metadata must be redacted and should not contain raw secrets, full card details, customer bank details, or sensitive webhook/refund payloads.
