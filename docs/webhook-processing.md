# Webhook Processing

Paystack webhook handling must be secure, idempotent, and safe when Paystack retries events.

T008 creates pending Paystack payment records during checkout initialization. T010/T012 planning adds organisation payment accounts and Paystack subaccounts to that initialization flow. T009 must treat verified webhooks as the source of truth for changing payment status, invoice balances, invoice status, and receipts.

## Required Rules

- Paystack webhook signature verification is mandatory.
- Raw request body must be available for signature verification.
- Invalid signatures must be rejected.
- Invalid webhook attempts should be logged safely.
- Valid events must be stored.
- Duplicate events must be idempotent.
- Duplicate Paystack references must not double-count payments.
- Successful payments must update payment status.
- Successful payments must recalculate invoice `amount_paid_kobo` and `balance_due_kobo`.
- Successful payments must update invoice status.
- Successful payments must not generate receipts until T014.
- Successful payments should preserve the `provider_subaccount_code` used during initialization for traceability.
- After T012, newly initialized payment records should retain the organisation payment account `provider_subaccount_code`; webhook processing should preserve that stored value rather than deriving it from webhook payloads.
- Failed payments must be recorded without marking invoice paid.
- Webhook processing should be safe if Paystack retries the same event.

## Processing Flow

1. Receive webhook with raw body.
2. Verify signature.
3. Extract event type and payment reference.
4. Store event with redacted payload.
5. Check if event/reference was already processed.
6. Find matching pending payment.
7. Verify amount, currency, and stored payment context.
8. Update payment status.
9. Recalculate invoice payment totals.
10. Update invoice status.
11. Write audit log.
12. Mark event processed.

Receipt generation starts in T014 and is intentionally skipped in T009.

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
| Partial payment | Update invoice to `partially_paid`; receipt generation is T014. |
| Overpayment | Mark invoice `paid`, balance `0`, and flag overpayment in audit metadata. |
| Webhook before callback | Process webhook normally if pending payment reference exists. |

## Receipt Generation

Receipt generation is intentionally out of scope for T009. T014 should generate one receipt per successful payment and enforce uniqueness on `payment_id`.

## Audit Logging

Write audit logs for:

- Successful payment reconciliation.
- Failed payment event.
- Duplicate ignored event.
- Amount or currency mismatch.
- Cancelled/void invoice payment arrival.
- Receipt generation.

Audit metadata must be redacted and should not contain raw secrets, full card details, or sensitive webhook payloads.
