# Status Rules

Invoice totals must be calculated server-side. Never trust totals from the frontend.

## InvoiceStatus

| Status | Meaning |
| --- | --- |
| `draft` | Invoice created but not sent. |
| `sent` | Invoice has been sent/shared or public link generated. |
| `viewed` | Customer opened the public invoice page. |
| `partially_paid` | Net received is greater than zero but less than invoice total. |
| `paid` | Net received is greater than or equal to invoice total. |
| `overdue` | Due date has passed and balance due is greater than zero. |
| `cancelled` | Invoice cancelled before payment completion. |
| `void` | Invoice voided because of error but retained for records. |

## PaymentStatus

| Status | Meaning |
| --- | --- |
| `pending` | Paystack transaction initialized but not confirmed. |
| `successful` | Paystack webhook or server-side Paystack verification confirms payment success. |
| `failed` | Paystack webhook confirms failure. |
| `abandoned` | Payment was initialized but not completed after a defined time. |
| `refunded` | Historical payment status for refunded charges if explicitly used. Refund lifecycle is tracked in `payment_refunds`. |

## Invoice Transition Rules

| Trigger | Rule |
| --- | --- |
| Create invoice | Set status to `draft`. |
| Send/share invoice or generate public link | Move `draft` to `sent`. |
| Public page opened | Move `sent` to `viewed`; keep stronger payment statuses unchanged. |
| Paystack payment initialized | Require an active organisation payment account, create a pending payment with subaccount context only, and do not change invoice payment totals or invoice status. |
| Successful payment received | Recalculate paid and balance amounts, then apply payment-derived status. |
| Partial payment | Set `partially_paid` when `amount_paid_kobo > 0` and less than `total_kobo`. |
| Full payment | Set `paid` when `amount_paid_kobo >= total_kobo`; set `paid_at` when the invoice first becomes fully paid. |
| Due date passes | Set `overdue` when balance due is greater than zero and invoice is not `draft`, `cancelled`, `void`, or `paid`. |
| Cancel invoice | Set `cancelled` only when invoice is not fully paid. |
| Void invoice | Set `void` for correction/error cases and retain all records. |

T006 implements create, send, draft edit, cancel, and void transitions only. T007 adds public view tracking. T008 adds Paystack initialization and pending payment records only. T009 adds webhook-driven payment reconciliation. Receipt generation is reserved for T014.

Payment Setup gating rules:

- Payment Setup is not required to create customers or invoices.
- Payment Setup is not required to send or share an invoice.
- Public invoice viewing remains available without Payment Setup.
- Public payment initialization must be blocked when no active organisation payment account exists.
- When payment setup is incomplete, public invoice `paymentSummary.available` must be `false` with a safe setup-incomplete message.
- Payment Setup state does not change invoice status; it only changes public payment availability.

Public view tracking rules:

- Public invoice view moves `sent` to `viewed` only.
- Repeated public views do not create repeated viewed status events.
- `overdue`, `partially_paid`, `paid`, `cancelled`, and `void` invoices must not move to `viewed`.
- Public view events use `actor_user_id = null` and safe redacted metadata only.

## Amount Recalculation

`amount_paid_kobo` is derived from persisted payment/refund records:

```text
grossSuccessfulKobo = sum(successful payments)
processedRefundsKobo = sum(processed refunds for those payments)
netReceivedKobo = max(grossSuccessfulKobo - processedRefundsKobo, 0)
amount_paid_kobo = netReceivedKobo
```

`amount_paid_kobo` may exceed `total_kobo` when an invoice is overpaid.

Failed, abandoned, pending, stale pending, and superseded retry attempts do not contribute to invoice paid totals.

`balance_due_kobo` is:

```text
max(total_kobo - netReceivedKobo, 0)
```

Recalculate both values after every successful confirmation, duplicate successful confirmation, processed refund, and maintenance repair that could affect invoice state. Failed, abandoned, pending, and superseded attempts remain stored but do not contribute money.

## Overdue Calculation

An invoice is overdue when:

- `due_date` is before the current date.
- `balance_due_kobo > 0`.
- Status is not `draft`, `paid`, `cancelled`, or `void`.

Overdue status is deterministic and can be recalculated by a scheduled job, read-time query, or explicit status refresh. T006 displays overdue state at read time without introducing scheduled jobs.

## Partial Payment Behaviour

- Partial payments are allowed in the MVP.
- Each successful payment is recorded independently.
- The invoice remains `partially_paid` until successful payment totals meet or exceed `total_kobo`.
- T014 issues one immutable receipt for each provider-confirmed successful payment.
- Public partial payment entry is not exposed in MVP.
- Public payment initialization charges the current server-calculated `balance_due_kobo`.
- Public payment initialization must use the active organisation `provider_subaccount_code`.
- Initializing a payment must not mark an invoice `paid`, `partially_paid`, or update `amount_paid_kobo`/`balance_due_kobo`; verified provider confirmation is the source of truth for reconciliation.
- A verified `charge.success` webhook can mark a matching payment `successful`.
- A server-side Paystack Verify Transaction fallback can also mark a matching payment `successful` after validating that the returned reference, amount in kobo, and currency match the pending payment. The frontend callback itself is never proof of payment.
- After a successful payment, invoice paid and balance amounts are recalculated from all successful payments minus processed refunds for the invoice.
- Full payment marks the invoice `paid` and sets `paid_at` the first time it becomes fully paid.
- Partial successful totals mark the invoice `partially_paid`.
- If a previously overdue invoice is fully paid, it becomes `paid`.
- Pending, failed, or abandoned attempts after an invoice is already paid, cancelled, void, or has `balance_due_kobo = 0` are superseded audit records. They should remain stored but should not appear as active reconciliation work.
- For unresolved invoices with multiple pending attempts, only the newest pending attempt should remain active reconciliation work; older pending attempts are superseded. True anomalies such as amount mismatch, currency mismatch, unknown reference, overpayment, cancelled/void invoice payment, processing error, or settlement mismatch remain review-required.

## Cancellation Rules

- `draft`, `sent`, `viewed`, `overdue`, and `partially_paid` invoices can be cancelled if business rules allow.
- Fully paid invoices should not be cancelled; use refund or void workflows if needed later.
- Cancelled invoices keep line items, payments, status events, and audit logs.
- Public payment initialization should be blocked for cancelled invoices.

## Voiding Rules

- Void is used for invoice errors where the record must be retained.
- Voided invoices should not accept new payments.
- Voiding requires a reason and audit log entry.
- Existing payments stay attached for record integrity and must be reviewed manually if a void occurs after payment.

## Cancelled/Void Invoice Payment Arrival

If a payment webhook arrives for a cancelled or void invoice:

- Store the webhook event.
- Record or update the payment status based on Paystack truth.
- Do not move the invoice to `paid` automatically.
- Write an audit log requiring manual review.
- T014 still issues a receipt because provider-confirmed money moved. Keep the reconciliation review flag so the business can handle the cancelled/void invoice anomaly separately.

## Duplicate Webhook Events

Duplicate events must be idempotent:

- Store the duplicate safely or mark it as duplicate.
- Do not double-count payment amounts.
- Do not generate duplicate receipts. `receipts.payment_id` is unique and receipt creation is idempotent.
- Do not write repeated status transitions unless useful as safe audit metadata.

## Overpayment

If net received exceeds invoice total:

- Record successful payments at the actual provider-confirmed amount.
- Set `amount_paid_kobo` to `netReceivedKobo`, even when that exceeds `total_kobo`.
- Set `balance_due_kobo` to `0`.
- Set invoice status to `paid`.
- Flag the invoice/payment for overpayment review.
- Needs Review should explain the excess amount and suggest refunding the excess.
- Overpaid invoices must not remain `overdue` or `partially_paid`.

## Refunds and Future Adjustments

`payment_refunds` tracks refund lifecycle separately from the original charge status:

- `pending` and `processing` refunds do not reduce `amount_paid_kobo`.
- `needs_attention` keeps the overpayment review open and requires provider-side action.
- `failed` keeps the overpayment review open.
- `processed` refunds reduce net received and trigger invoice financial recalculation.
- Processed refunds can resolve overpayment review when `overpaymentKobo` becomes zero.
- A successful payment can remain `successful` while one or more refund records exist.

`paid_at` is set when the invoice first becomes fully paid. If later processed refunds reduce net received below invoice total, the invoice status can become `partially_paid` or `overdue` according to the recalculated balance, but the original `paid_at` remains historical.

## Review Resolution

Review required means human or provider action is still needed. The following are not active review items by themselves:

- Old failed attempts after the invoice is fully paid.
- Old abandoned attempts after the invoice is fully paid.
- Old pending retries superseded by a successful payment.
- A non-success amount mismatch that did not move money and was later replaced by a successful payment.
- Missing payout account match on historical failed/abandoned attempts.

True active review examples include overpayment, amount/currency mismatch where money may have moved, unknown successful references, cancelled/void invoice payment arrival, successful payment settlement mismatch, refund failure, and refund needs-attention.

## Status Precedence

Terminal administrative statuses take precedence over payment-derived statuses:

```text
void > cancelled > paid > partially_paid > overdue > viewed > sent > draft
```

Implementation should be explicit and deterministic, not dependent on enum sort order.
