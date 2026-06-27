# Status Rules

Invoice totals must be calculated server-side. Never trust totals from the frontend.

## InvoiceStatus

| Status | Meaning |
| --- | --- |
| `draft` | Invoice created but not sent. |
| `sent` | Invoice has been sent/shared or public link generated. |
| `viewed` | Customer opened the public invoice page. |
| `partially_paid` | Successful payments exist but total paid is less than invoice total. |
| `paid` | Total successful payments are greater than or equal to invoice total. |
| `overdue` | Due date has passed and balance due is greater than zero. |
| `cancelled` | Invoice cancelled before payment completion. |
| `void` | Invoice voided because of error but retained for records. |

## PaymentStatus

| Status | Meaning |
| --- | --- |
| `pending` | Paystack transaction initialized but not confirmed. |
| `successful` | Paystack webhook confirms payment success. |
| `failed` | Paystack webhook confirms failure. |
| `abandoned` | Payment was initialized but not completed after a defined time. |
| `refunded` | Refund recorded. |

## Invoice Transition Rules

| Trigger | Rule |
| --- | --- |
| Create invoice | Set status to `draft`. |
| Send/share invoice or generate public link | Move `draft` to `sent`. |
| Public page opened | Move `sent` to `viewed`; keep stronger payment statuses unchanged. |
| Successful payment received | Recalculate paid and balance amounts, then apply payment-derived status. |
| Partial payment | Set `partially_paid` when `amount_paid_kobo > 0` and less than `total_kobo`. |
| Full payment | Set `paid` when `amount_paid_kobo >= total_kobo`; set `paid_at` when the invoice first becomes fully paid. |
| Due date passes | Set `overdue` when balance due is greater than zero and invoice is not `draft`, `cancelled`, `void`, or `paid`. |
| Cancel invoice | Set `cancelled` only when invoice is not fully paid. |
| Void invoice | Set `void` for correction/error cases and retain all records. |

## Amount Recalculation

`amount_paid_kobo` is the sum of successful, non-refunded payments for the invoice.

`balance_due_kobo` is:

```text
max(total_kobo - amount_paid_kobo, 0)
```

Recalculate both values after every successful, failed, refunded, duplicate-ignored, cancellation, or void-related payment event that could affect invoice state.

## Overdue Calculation

An invoice is overdue when:

- `due_date` is before the current date.
- `balance_due_kobo > 0`.
- Status is not `draft`, `paid`, `cancelled`, or `void`.

Overdue status is deterministic and can be recalculated by a scheduled job, read-time query, or explicit status refresh. Persisting the status is acceptable if status events are written consistently.

## Partial Payment Behaviour

- Partial payments are allowed in the MVP.
- Each successful payment is recorded independently.
- The invoice remains `partially_paid` until successful payment totals meet or exceed `total_kobo`.
- A receipt is generated for each successful payment.
- Public partial payment entry is not exposed in MVP. Public payment initialization charges the current server-calculated `balance_due_kobo`.

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
- Do not generate a normal receipt unless the product explicitly accepts the payment as valid.

## Duplicate Webhook Events

Duplicate events must be idempotent:

- Store the duplicate safely or mark it as duplicate.
- Do not double-count payment amounts.
- Do not generate duplicate receipts.
- Do not write repeated status transitions unless useful as safe audit metadata.

## Overpayment

If payment amount exceeds invoice balance:

- Record the payment at the actual successful amount.
- Set `amount_paid_kobo` to the full sum of successful payments.
- Set `balance_due_kobo` to `0`.
- Set invoice status to `paid`.
- Flag the invoice/payment for overpayment review in audit metadata.

## Refunds and Future Adjustments

`paid_at` is set when the invoice first becomes fully paid. If a paid invoice later changes because of a refund or future adjustment, the MVP should preserve the original `paid_at` and flag the case for future refund workflow work. Refunds are represented in `PaymentStatus` but are not fully implemented in the MVP.

## Status Precedence

Terminal administrative statuses take precedence over payment-derived statuses:

```text
void > cancelled > paid > partially_paid > overdue > viewed > sent > draft
```

Implementation should be explicit and deterministic, not dependent on enum sort order.
