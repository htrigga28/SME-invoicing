# Seed Data Plan

Seed data should make the dashboard and demo flows feel realistic while staying safe for a public portfolio project. Use safe demo passwords only. Do not use real credentials.

## Demo Organisation

Create one completed demo organisation/workspace:

- Organisation name: `Akin & Co Creative Services`
- Slug: `akin-co-demo`
- Business profile completed.
- Currency: `NGN`.
- Onboarding completed.

Business profile should include:

- Business name.
- Contact email.
- Nigerian phone number format.
- Lagos or Abuja business address.
- Optional placeholder logo file reference.

## Demo Users

Create four demo users:

| Email | Role | Purpose |
| --- | --- | --- |
| `owner@demo.com` | Owner | Full demo and admin flow. |
| `admin@demo.com` | Admin | Operations management flow. |
| `accountant@demo.com` | Accountant | Invoice/payment/export flow. |
| `viewer@demo.com` | Viewer | Read-only restriction demo. |

Recommended safe password for all demo users:

```text
DemoPass123!
```

## Customers

Create 12 customers with realistic Nigerian SME names, emails, phones, and billing addresses. Include a mix of agencies, retailers, consultancies, schools, and service businesses.

Customer states:

- 10 active customers.
- 2 archived customers with historical invoices.

## Invoices

Create 35 invoices across statuses:

| Status | Count |
| --- | ---: |
| Paid | 12 |
| Unpaid/sent/viewed | 8 |
| Overdue | 6 |
| Partially paid | 5 |
| Cancelled | 2 |
| Void | 2 |

Each invoice should include:

- Organisation-scoped invoice number.
- Public token.
- Customer.
- 1 to 5 line items.
- `subtotal_kobo`, `discount_kobo`, `tax_kobo`, `total_kobo`, `amount_paid_kobo`, `balance_due_kobo`.
- Issue and due dates spread over recent months.
- Status events.

## Payments and Receipts

Create payments for:

- Paid invoices.
- Partially paid invoices.
- Some failed or abandoned attempts.
- At least one overpayment review case if useful for the reconciliation page.

Each successful payment should have:

- Paystack-style provider reference.
- Payment event.
- Receipt.
- Audit log.

Failed and abandoned payments should not generate receipts.

## Payment Events

Create payment events for:

- Successful Paystack charge.
- Failed payment.
- Duplicate retry event.
- Amount mismatch review case, if useful.

Payloads must be redacted and safe.

## Invitations

Optional invitation records for UI states:

- One pending invitation.
- One revoked invitation.
- One expired invitation.

Use hashed tokens only. Do not seed raw tokens except in a local-only seed output if needed for development.

## Audit Logs

Seed audit logs for:

- Business profile completion.
- Customer creation.
- Invoice creation.
- Invoice sent.
- Public invoice viewed.
- Payment reconciled.
- Receipt generated.
- CSV export.
- Team invitation created/revoked.

## Dashboard Realism

Seed dates and amounts so the dashboard shows:

- Total invoiced.
- Collected revenue.
- Outstanding balance.
- Overdue amount.
- Collection rate.
- Recent invoices.
- Recent payments.
- Monthly collections.
- Invoice status breakdown.

Avoid perfectly round distributions. Use realistic NGN amounts and mixed payment timing.
