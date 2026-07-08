# Design Direction

## Product Feel

The UI should feel like a modern finance operations workspace:

- Clean
- Trustworthy
- Financial
- Operational
- Professional
- Dashboard-first
- Workflow-focused

Avoid:

- Decorative landing-page-style UI.
- Excessive gradients.
- Fake mockup screens.
- Overly spacious layouts that weaken data density.
- Building visual polish before workflow correctness.

Every primary workflow must be demoable in under 5 minutes.

## Layout Principles

- Use a restrained app shell with sidebar navigation on desktop.
- Prioritize data tables, compact cards, forms, and clear status badges.
- Keep primary actions visible but not oversized.
- Treat public invoice pages as customer-facing documents with a payment action, not marketing pages.
- Use consistent status colors for invoice and payment states.
- Prefer clear empty/loading/error states over decorative filler.

## Screen Guidance

| Screen | Guidance |
| --- | --- |
| Dashboard | Show KPI cards, status breakdowns, recent invoices, recent payments, and monthly collections. Prioritize fast operational scanning. |
| Customers list/detail | Use searchable tables, customer summary details, invoice history, payment history, and archive state. |
| Invoice list | Include invoice number, customer, issue date, due date, total, paid amount, balance, status, and actions. |
| Invoice creation | Use a focused form with customer selector, due date, line items, discount, tax, notes, and server-calculated totals preview. |
| Invoice detail | Show invoice metadata, line items, status timeline, payments, receipt links, and actions allowed by role/status. |
| Public invoice payment page | Present the invoice clearly, show balance due, and make Pay Now the primary action. Avoid internal admin data. |
| Payments/reconciliation page | Show payment references, provider status, matched invoice, customer, amount, date, and reconciliation state. |
| Receipts page | Show receipt number, invoice, customer, payment reference, amount, date, and downloadable/viewable detail. |
| Exports page | Use focused export panels per dataset instead of one universal form. Keep filters compact and make download state explicit. |
| Settings/team page | Keep business profile, members, invitations, and role management separate but easy to scan. |
| Audit logs page | Use filters for actor, action, category, entity type, and date. Show concise metadata rows and keep raw sensitive payloads out of the UI. |

## Dashboard Content

Dashboard should include:

- Total invoiced.
- Collected revenue.
- Outstanding balance.
- Overdue amount.
- Paid invoices.
- Unpaid invoices.
- Overdue invoices.
- Collection rate.
- Recent invoices.
- Recent payments.
- Invoice status breakdown.
- Monthly collections.

## Public Invoice Page Content

Public invoice page should include:

- Business logo/name.
- Invoice number.
- Invoice status.
- Customer information.
- Line items.
- Subtotal.
- Discount.
- Tax.
- Total.
- Amount paid.
- Balance due.
- Due date.
- Pay Now button.
- Secure payment note.

The page must not expose internal organisation IDs, member records, audit logs, private notes, or platform admin controls.

## Responsive Behaviour

| Breakpoint | Behaviour |
| --- | --- |
| Desktop | Sidebar layout with data tables and cards. |
| Tablet | Collapsible sidebar and stacked cards. |
| Mobile | Top navigation or drawer, stacked cards, simplified tables/cards. |

## Required UI States

Every primary workflow should include:

- Empty states.
- Loading skeletons.
- Error states.
- Success states.
- Disabled submit states.
- Form validation states.
- Toast feedback.

## Trade-Offs

- Workflow correctness comes before visual flourish.
- Dense operational screens are preferred over spacious marketing layouts.
- Public invoice pages can be more polished than internal pages, but they must remain clear and payment-focused.
