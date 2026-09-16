# Lumina v2 — Build Brief

**Status:** APPROVED FOR IMPLEMENTATION  
**Date:** 2026-09-16  
**Purpose:** Give Codex enough product and implementation context to begin building immediately. This is not a long planning phase.

## 1. Product Direction

Lumina should evolve from an SME invoice/payment reconciliation app into a **receivables operating system** for African businesses.

Working product thesis:

> Lumina helps businesses turn completed work into predictable cash by connecting invoicing, payment collection, follow-up, reconciliation, customer collaboration, compliance, and receivables intelligence in one workflow.

Customer-facing shorthand:

> **Invoice. Collect. Reconcile. Know what gets paid next.**

The near-term goal is not to become a full accounting suite, bank, payroll platform, ERP, or expense product. The product should go deeper into **invoice-to-cash / accounts receivable** before expanding sideways.

## 2. What Already Exists and Must Be Preserved

The existing repository is the foundation. Do not rebuild it.

Important existing strengths include:

- Next.js product application and separate marketing application.
- NestJS API.
- PostgreSQL + Drizzle.
- Organisation-scoped multi-tenancy.
- Owner/Admin/Accountant/Viewer RBAC.
- Customers.
- Invoice creation, status transitions, line items, discounts/tax, public invoice links.
- Paystack payment initialization and organisation subaccounts.
- Webhook processing and payment verification.
- Reconciliation states, mismatch handling, superseded attempts, overpayments, refunds.
- Immutable receipts.
- Dashboard metrics and charts.
- CSV exports.
- Audit logs.
- Shared UI primitives and an existing design system.
- Lumina marketing site and the existing “Payment Trail” narrative idea.

Preserve financial correctness, tenant isolation, payment idempotency, auditability, receipt immutability, safe exports, and server-authoritative totals.

### Marketing visual direction update

The original dark graphite + neon-lime marketing treatment is no longer authoritative.

The **Payment Trail narrative remains**, but the marketing site should now express it through a light, warm, inviting editorial-fintech system with product-led scroll storytelling. See `docs/lumina-v2/05_MARKETING_SITE_REDESIGN.md`.

The marketing redesign should not be interpreted as a reason to rewrite product domain behavior.

## 3. Source-of-Truth / Precedence

For Lumina v2 work, use this order when documents disagree:

1. `docs/lumina-v2/00_BUILD_BRIEF.md`
2. `docs/lumina-v2/01_FEATURE_AND_BUILD_SEQUENCE.md`
3. `docs/lumina-v2/02_UI_UX_DIRECTION.md`
4. `docs/lumina-v2/03_CODEX_EXECUTION_GUIDE.md`
5. `docs/lumina-v2/05_MARKETING_SITE_REDESIGN.md` for all marketing-site visual, motion, and homepage-story decisions.
6. Existing domain-specific docs such as `product-spec.md`, `status-rules.md`, `rbac-matrix.md`, `database-schema.md`, `api-contracts.md`.
7. Existing T017 design docs where they do not conflict with the v2 UI direction.
8. `apps/marketing/DESIGN.md` only where it has been updated to match the Lumina v2 marketing direction.

Special precedence rule:

> For `apps/marketing`, `05_MARKETING_SITE_REDESIGN.md` overrides any older dark-first marketing assumptions anywhere else in the repository.

The old MVP documents remain useful for existing behavior and invariants. They are not the ceiling for future scope.

## 4. Strategic Product Shape

Lumina should eventually cover six connected areas:

### Billing

- Invoices.
- Quotes/estimates.
- Products/services.
- Templates.
- Recurring billing.
- Credit/debit notes.

### Collections

- Automated reminder sequences.
- Collection work queue.
- Email / WhatsApp / SMS follow-up.
- Promise-to-pay tracking.
- Collector ownership and tasks.

### Customer Receivables

- Customer 360.
- Statements.
- Customer portal.
- Invoice/payment/communication history.
- Disputes.

### Payments & Cash Application

- Multiple payment providers over time.
- Payment matching and exception handling.
- Multi-invoice allocation.
- Partial/over/under payment handling.
- Unapplied cash and customer credits later.

### Intelligence

- Aging.
- DSO.
- CEI.
- Expected cash.
- Collection prioritisation.
- Customer payment behaviour.

### Compliance & Scale

- Nigerian e-invoicing/NRS integration.
- Multi-currency later.
- Accounting/ERP integrations later.
- Multi-entity, SSO and enterprise controls later.

## 5. Competitive Research Summary

The build direction is informed by the following product groups:

### SME invoicing

- Billboxx — https://www.billboxx.com/
- Stripe Invoicing — https://stripe.com/invoicing
- Zoho Invoice — https://www.zoho.com/invoice/
- Square Invoices — https://squareup.com/us/en/invoices
- Xero — https://www.xero.com/
- QuickBooks — https://quickbooks.intuit.com/

These establish expectations around recurring invoices, reminders, estimates, customer portals, templates, payment links, invoice status, statements and payment tracking.

### AR automation

- Upflow — https://upflow.io/
- Kolleno — https://www.kolleno.com/
- Chaser — https://www.chaserhq.com/

These establish the direction for collections queues, automated follow-up, DSO/aging, promise-to-pay, customer risk and cash forecasting.

### Enterprise order-to-cash / AR

- Versapay — https://www.versapay.com/
- Billtrust — https://www.billtrust.com/
- HighRadius — https://www.highradius.com/

These establish the long-term direction for cash application, disputes, integrations, credit workflows and enterprise controls.

### Nigerian compliance

- NRS e-invoicing — https://einvoice.nrs.gov.ng/

NRS/e-invoicing is a strategic future track. Do not block the immediate Lumina v2 build on it.

## 6. Product Rules

- **Receivables-first.** Do not turn Lumina into generic accounting software.
- **One connected financial trail.** Invoice creation, delivery, customer view, follow-up, payment, reconciliation and receipt should read as one timeline.
- **Action over reporting.** A metric should lead to a useful next action.
- **SME-simple, finance-team-deep.** Advanced capability should progressively appear without overwhelming small businesses.
- **No fake intelligence.** Forecasting/risk must be explainable from actual data.
- **No financial state from frontend guesses.** Financial truth remains backend-derived.
- **No full rewrite.** Extend the current domain model carefully.
- **No microservices.** Keep the modular NestJS monolith unless a future scaling requirement proves otherwise.

## 7. Immediate Build Goal

The first implementation cycle should make Lumina visibly and functionally better, not just create infrastructure.

The first major vertical slices are:

1. **Invoice Experience 2.0** — better authoring, reusable products/services, live preview, richer invoice metadata.
2. **Delivery + Activity** — real delivery events, view tracking and one invoice activity timeline.
3. **Recurring + Reminder Automation** — recurring invoices, scheduling and reminder sequences with durable execution.
4. **Customer 360 + Portal** — statements, customer receivables overview and a proper customer-facing portal.
5. **Collections Workspace** — action queue, promise-to-pay, collector notes/tasks and direct collection actions.

Do not wait for the entire roadmap to be designed before starting item 1.

The marketing redesign may run as a separate workstream using `05_MARKETING_SITE_REDESIGN.md`; it does not need to block these product slices.

## 8. What Not to Prioritise Yet

Do not spend the next build cycle on:

- Business banking.
- Virtual employee cards.
- Expense management.
- Payroll.
- Inventory.
- Full general ledger accounting.
- AP/bill pay.
- Building lending/financing infrastructure.
- ERP replacement.
- Complex AI chat interfaces.

These are distractions from the core receivables product.

## 9. Definition of Success for Lumina v2 First Cycle

A demo should be able to show this story end-to-end:

```text
Create a professional invoice
→ send it
→ customer opens it
→ Lumina records the event
→ Lumina follows up automatically if needed
→ finance user sees the account in a collection queue
→ customer promises or makes payment
→ Lumina reconciles the payment
→ receipt is created
→ dashboard/customer account immediately reflects the new truth
```

If the product can make that flow feel polished, clear and reliable, it has moved beyond a portfolio invoice CRUD app into a credible receivables product.
