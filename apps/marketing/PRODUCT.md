# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Lumina primarily serves Nigerian SME owners and operators who create invoices, collect Paystack payments, and need to understand what has been paid without maintaining a separate reconciliation spreadsheet. Finance and operations teammates are important secondary users.

## Product Purpose

Lumina connects customer invoices, Paystack payment attempts, provider-confirmed payments, payout routing, refunds, invoice balances, and receipts in one operational trail. Success means a business can see what was collected, what remains due, and what needs attention without hunting through references or manually updating invoice state.

## Positioning

Lumina is an invoice payment operations workspace for Nigerian SMEs. Its distinctive mechanism is a provider-confirmed payment trail: successful Paystack payments and processed refunds determine invoice financial truth, while retries and exceptions remain visible without overwhelming day-to-day reconciliation.

## Operating Context

Users work with customer invoices, public payment links, Nigerian bank accounts, NGN amounts, Paystack checkout and subaccounts, payment references, receipts, CSV exports, and audit history. Owners commonly review this information between other business tasks rather than inside a dedicated accounting department.

## Capabilities and Constraints

- Lumina creates invoices, accepts public invoice payments through Paystack, reconciles confirmed payments, tracks refunds, issues receipts, and exposes operational reporting and CSV exports.
- Lumina supports Nigerian businesses, Nigerian payout accounts, NGN invoices, and Paystack in the initial product.
- Lumina does not hold funds, provide wallet balances, collect merchant Paystack secret keys, or replace full bookkeeping, payroll, inventory, or tax software.
- Payment amounts and payout routing are server-derived. Signed webhooks and server-side verification are the provider-truth mechanisms.
- The primary marketing conversion is joining the early-access waitlist; sign in is secondary.

## Brand Commitments

The product name is Lumina. Its voice is direct, financially literate, calm, and useful rather than hyped. The brand keeps a dark operating environment, a recognisable lime signal color, Hanken Grotesk for interface and marketing text, and JetBrains Mono only for references, money, timestamps, code, and compact operational data.

## Evidence on Hand

The codebase contains implemented product workflows and accurate demonstration states for payout setup, invoices, payment reconciliation, overpayment review, refunds, receipts, dashboards, exports, and audit logs. Marketing demonstrations may use clearly labelled synthetic data. There are no approved customer logos, testimonials, benchmarks, pricing claims, certifications, or availability claims; future work must not fabricate them.

## Product Principles

- Show the payment trail instead of describing a generic dashboard.
- Translate provider complexity into an owner-readable next action.
- Keep financial truth textual and inspectable, not hidden inside decoration.
- Earn trust with accurate boundaries and working product states.
- Make the primary action obvious without turning the page into a sequence of repeated CTAs.

## Accessibility & Inclusion

The marketing experience must support keyboard navigation, visible focus, semantic structure, readable contrast, touch targets, reduced motion, and responsive layouts without hiding essential financial information behind color or animation.
