# Demo Script

The MVP should be demoable in under 5 minutes. The demo should show that the product is an operational invoice and payment reconciliation workspace, not just static screens.

## Demo Credentials

Use safe demo accounts:

- `owner@demo.com`
- `admin@demo.com`
- `accountant@demo.com`
- `viewer@demo.com`

Recommended demo password:

```text
DemoPass123!
```

## Five-Minute Flow

| Step | Screen | Action | Expected result | Reviewer should notice |
| --- | --- | --- | --- | --- |
| 1 | Login | Login as `owner@demo.com`. | Owner lands in the app. | Authentication works and routes are protected. |
| 2 | Dashboard | Show seeded dashboard. | KPIs, recent invoices, recent payments, status breakdown, and monthly collections are visible. | The workspace feels operational and data-rich. |
| 3 | Customers | Create a new customer. | Customer appears in list/detail view. | Customer management is simple and organisation-scoped. |
| 4 | Invoice creation | Create a new invoice with line items. | Server-calculated totals appear and invoice is saved. | Line items, NGN/kobo totals, due date, and customer link are correct. |
| 5 | Invoice detail | Send or enable public invoice link. | Invoice moves from draft to sent and public URL is available. | Status transitions are clear and auditable. |
| 6 | Public invoice | Open public invoice page. | Customer-facing invoice loads without login. | Public page exposes only intended invoice/payment data. |
| 7 | Public payment | Click Pay Now. | Paystack test payment initialization starts. | Payment flow is connected to invoice balance. |
| 8 | Webhook simulation/test payment | Complete or simulate Paystack success webhook. | Payment is recorded and invoice status updates. | Webhook, not the frontend callback, is the source of truth. |
| 9 | Invoice detail | Return to invoice. | Invoice shows paid or partially paid status and payment history. | Reconciliation is visible and deterministic. |
| 10 | Payments/reconciliation | Open payments page. | Paystack reference is matched to invoice/customer. | Payment reference matching is clear. |
| 11 | Receipt | Open receipt. | Receipt shows amount, invoice, customer, and payment reference. | Receipt generation follows successful payment. |
| 12 | Exports | Export invoice records. | CSV downloads with filtered invoice data. | Operational export is available. |
| 13 | Viewer restriction | Login as `viewer@demo.com` or switch session. | Viewer can read but cannot create/update records. | RBAC is enforced beyond UI convenience. |

## Demo Talking Points

- Direct registration creates an internal organisation/workspace automatically.
- The user completes a business profile, which is the customer-facing concept.
- Invoices are public-payable without exposing internal data.
- Reconciliation means Paystack references are matched to invoices and status is updated.
- Tenant isolation and RBAC are core product constraints.

## Fallback Demo Notes

If live Paystack test checkout is unavailable, use a safe webhook simulation in development and explain that production webhook handling still verifies Paystack signatures.

If email delivery is not implemented, copy the public invoice URL directly during the demo and note that Brevo email delivery is planned later.
