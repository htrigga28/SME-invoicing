# Webhook Processing

Paystack webhook handling must be secure, idempotent, and safe when Paystack retries events.

T008 creates pending Paystack payment records during checkout initialization. T009 must treat verified webhooks as the source of truth for changing payment status, invoice balances, invoice status, and receipts.

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
- Successful payments must generate a receipt.
- Failed payments must be recorded without marking invoice paid.
- Webhook processing should be safe if Paystack retries the same event.

## Processing Flow

1. Receive webhook with raw body.
2. Verify signature.
3. Extract event type and payment reference.
4. Store event with redacted payload.
5. Check if event/reference was already processed.
6. Find matching pending payment.
7. Verify amount and currency.
8. Update payment status.
9. Recalculate invoice payment totals.
10. Update invoice status.
11. Generate receipt if payment successful.
12. Write audit log.
13. Mark event processed.

## Signature Verification

- Use the raw request body exactly as received.
- Reject requests with missing or invalid Paystack signature headers.
- Do not parse and reserialize the body before verification.
- Log invalid attempts without storing secrets or full sensitive payloads.

## Idempotency

Use database constraints and transaction boundaries to make processing idempotent.

Idempotency keys should include:

- Provider name.
- Provider event ID where available.
- Provider payment reference.
- Event type.

Rules:

- A duplicate event must not create a second successful payment.
- A duplicate payment reference must not add to `amount_paid_kobo` twice.
- A duplicate successful event must not generate a second receipt.
- Processing should be safe to retry after transient failure.

## Payment Matching

Match incoming events to a pending payment by:

- `provider = paystack`.
- `provider_reference`.
- Expected `amount_kobo`.
- Expected `currency = NGN`.

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
| Partial payment | Update invoice to `partially_paid` and generate receipt for successful payment. |
| Overpayment | Mark invoice `paid`, balance `0`, and flag overpayment in audit metadata. |
| Webhook before callback | Process webhook normally if pending payment reference exists. |

## Receipt Generation

Generate one receipt per successful payment. Enforce a unique receipt on `payment_id` so retries cannot create duplicate receipts.

Receipt generation should happen in the same transaction as successful payment processing where practical.

## Audit Logging

Write audit logs for:

- Successful payment reconciliation.
- Failed payment event.
- Duplicate ignored event.
- Amount or currency mismatch.
- Cancelled/void invoice payment arrival.
- Receipt generation.

Audit metadata must be redacted and should not contain raw secrets, full card details, or sensitive webhook payloads.
