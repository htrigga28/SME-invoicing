# Lumina v2 — Feature Scope and Build Sequence

**Status:** APPROVED FOR IMPLEMENTATION  
**Intent:** Define the smallest useful execution sequence. This is an implementation roadmap, not a request for another planning phase.

## 1. Build Philosophy

- Ship vertical slices.
- Improve UI and capability together.
- Do not perform another app-wide visual rewrite before features move.
- Reuse the current design system and refactor it only where the v2 UI direction requires it.
- Every task should leave a demonstrably better product in production/demo.
- Update the existing Codex task board as work begins, but do not block implementation on rewriting all old planning documents first.

---

# FIRST BUILD CYCLE

T020 has shipped in PR #21, and the light authenticated-app overhaul shipped in PR #22.

Before T021, execute **MKT-01 — Marketing Site Editorial Receivables Evolution** using:

- `docs/lumina-v2/05_MARKETING_SITE_REDESIGN.md`
- `docs/lumina-v2/10_MARKETING_REFERENCE_LIBRARY.md`
- `docs/lumina-v2/11_CURRENT_MARKETING_UI_AUDIT.md`
- `docs/lumina-v2/12_MARKETING_REDESIGN_CODEX_PROMPT.md`

MKT-01 is a deliberate insertion before product expansion; it does **not** renumber T021–T028.

After MKT-01, resume this product sequence at T021.

## T020 — Invoice Experience 2.0 — DONE

### Goal

Make invoice creation feel comparable to modern Stripe/Mercury/Airwallex-class invoicing software and create the data foundation needed by recurring billing later.

### Build

- Product/service catalog.
- Reusable line-item selection from the catalog.
- Ability to create an ad-hoc item while authoring an invoice.
- Invoice live preview alongside the form on desktop.
- Mobile preview mode/action.
- PO/reference number.
- Customer-facing memo/note.
- Internal note where appropriate and clearly isolated from public data.
- Custom payment terms / due-date presets.
- Optional attachment support if the current storage architecture can support it cleanly; otherwise prepare the domain contract and defer upload transport.
- Duplicate invoice action.
- Autosave or robust draft preservation if feasible without introducing unsafe partial financial state.
- Improve invoice detail so authoring and document presentation share a clear visual model.

### Preserve

- Server-authoritative totals.
- Existing invoice lifecycle/status rules unless deliberately extended.
- Tenant isolation.
- Existing public token safety.
- Existing payment logic.

### UI outcome

Desktop should use a form + live document preview pattern rather than a long generic form.

### Acceptance

A user can create a realistic professional invoice substantially faster than in v1, with fewer repetitive fields and a high-quality live representation of what the customer will receive.

---

## T021 — Invoice Delivery, View Tracking and Unified Activity

### Goal

Turn the invoice from a static record into an observable delivery lifecycle.

### Build

- Real invoice email delivery using the existing/planned email provider.
- To/CC recipients.
- Delivery event records.
- Sent timestamp.
- Delivery/failure state where the provider supports it.
- Public invoice view event.
- First viewed / last viewed timestamps.
- Manual resend.
- Invoice activity timeline combining relevant events:
  - created;
  - edited;
  - sent;
  - delivered/failed;
  - viewed;
  - reminder sent;
  - payment started;
  - payment confirmed;
  - reconciliation outcome;
  - refund;
  - receipt issued;
  - later promise/dispute events when those modules exist.
- Keep safe internal audit history separate from customer-safe/public activity.

### Data model direction

Prefer explicit events over repeatedly overwriting historical state.

Possible domain additions include:

- `invoice_delivery_events`
- `invoice_view_events`
- communication/message records or a unified `communications` model if that cleanly supports future reminders.

Codex should inspect the current schema and choose the smallest coherent shape rather than blindly creating all suggested tables.

### Acceptance

Opening an invoice detail page should answer: **what happened to this invoice from creation to payment?**

---

## T022 — Recurring Billing, Scheduling and Reminder Automation

### Goal

Introduce the first meaningful automation layer.

### Build

- Recurring invoice schedules.
- Schedule start date.
- Frequency.
- Next invoice date.
- Optional end date.
- Pause/resume/cancel recurrence.
- Scheduled invoice send.
- Default due terms.
- Reminder sequence configuration.
- Default reminder templates.
- Per-customer or per-invoice opt-out/override where appropriate.
- Before-due and after-due steps.
- Retry-safe job execution.
- Communication/event history for every automated action.

### Execution infrastructure

The repository currently has no durable job/automation foundation. Add the minimum reliable mechanism compatible with the actual deployment architecture.

Rules:

- Do not add Redis merely because it is conventional if the deployment can reliably use a Postgres-backed job system with less infrastructure.
- Do not rely on in-memory timers.
- Scheduled work must survive process restarts.
- Jobs must be idempotent.
- Failed jobs need observable retry/failure state.
- If current hosting prevents a long-lived worker, use a durable database-backed schedule/job model plus a safe scheduled executor/cron entry until worker hosting is available.

### Acceptance

A user can create a monthly invoice series and configure automatic follow-up without needing to manually recreate or chase each invoice.

---

## T023 — Customer 360, Statements and Customer Portal

### Goal

Turn the current customer record into a receivables account and give the customer's finance team a useful self-service destination.

### Internal Customer 360

Header metrics:

- Total outstanding.
- Total overdue.
- Average days to pay where enough history exists.
- Last payment.
- Oldest overdue invoice.
- Active promise/dispute summary once those features exist.

Tabs/sections:

- Overview.
- Invoices.
- Payments.
- Statements.
- Activity.
- Contacts.
- Later: disputes/promises.

### Customer statements

- Statement by date range.
- Opening balance.
- Invoices/adjustments/payments.
- Closing balance.
- Download/print.
- Customer-safe data only.

### Portal

A customer should be able to:

- View all invoices available to their account.
- Filter open/paid/overdue.
- View invoice details.
- Pay an outstanding invoice.
- Download invoices.
- Download receipts.
- View/download statements.
- See credits/adjustments later.

Security must not expose one customer's documents to another customer.

### Acceptance

A business can send a customer to one place to understand the state of their account instead of forwarding individual invoice links repeatedly.

---

## T024 — Collections Workspace and Promise to Pay

### Goal

Move Lumina from invoice tracking into active receivables management.

### New Collections workspace

Primary table/list should prioritise accounts requiring action, not merely all invoices.

Suggested columns/data:

- Customer.
- Outstanding balance.
- Overdue balance.
- Oldest overdue age.
- Number of overdue invoices.
- Last contact.
- Active promise date/amount.
- Owner/collector.
- Priority/risk signal based on transparent rules.
- Next recommended/manual action.

### Actions

- Send reminder.
- Open customer.
- Log call/contact.
- Add internal note.
- Assign collector.
- Snooze/follow-up date.
- Create promise to pay.
- Mark promise fulfilled automatically from payment truth where possible.
- Detect broken promise after promised date.

### Promise-to-pay object

Minimum fields:

- Customer.
- Optional invoice(s).
- Promised amount.
- Promised date.
- Contact/person.
- Source/channel.
- Internal note.
- Owner.
- Status: active / fulfilled / broken / cancelled.

### Acceptance

A finance user can begin their day on one screen and know which accounts need attention and why.

---

# SECOND BUILD CYCLE

Do not fully detail these before T020–T024 are moving. The intent is enough to keep architecture extensible.

## T025 — Adjustments and Disputes

- Credit notes.
- Debit notes where required.
- Write-offs/bad debt handling.
- Partial adjustments.
- Dispute records.
- Disputed amount.
- Reason/category.
- Assignee.
- Comments/files.
- Resolution.
- Collections suppression or change of strategy while dispute is open.

## T026 — AR Reporting and Expected Cash

- Aging buckets.
- DSO.
- CEI.
- Average days to pay by customer.
- Collection effectiveness/trends.
- Broken-promise rate.
- Dispute rate.
- Expected cash based first on deterministic rules and observed payment history.
- Clear explanation for every forecast signal.

## T027 — Payment Provider Abstraction and Cash Application

- Isolate Paystack behind a payment-provider interface.
- Do not break current Paystack workflows.
- Support broader payment sources over time.
- Payment → invoice matching engine.
- One payment → multiple invoices.
- Multiple payments → one invoice.
- Partial payments.
- Unapplied cash.
- Customer credits later.
- Suggested matches.
- Manual exception workspace.
- Dedicated/virtual-account integration if provider choice and economics make sense.

## T028 — Nigerian E-Invoicing / NRS Track

- Treat as strategic compliance integration.
- Do not build until current official integration requirements are re-verified.
- Support structured invoice data, required tax identity fields, fiscalisation identifiers, QR/reference output, credit/debit document flows, status submission and failure/retry state as required by the chosen integration path.
- Prefer integrating through an approved provider/system integrator before considering becoming one.

---

# LATER / P2-P3 CAPABILITIES

These should influence extensibility but should not delay the first cycles:

- Multi-currency.
- Direct debit/autopay.
- Customer credits.
- Credit limits.
- Customer payment-risk scoring.
- AI-written reminder drafts.
- AI customer summaries.
- AI-assisted reconciliation suggestions.
- QuickBooks/Xero integrations.
- API keys and public developer API.
- Outgoing webhooks.
- Multi-entity organisations.
- Approval workflows.
- SSO/SAML.
- SCIM.
- NetSuite/Dynamics/SAP integrations.
- Embedded invoice financing through partners.

---

# GLOBAL DATA/DOMAIN RULES

## Financial truth

- Amounts remain integer minor units where applicable.
- Invoice totals are server-calculated.
- Payment provider events are not trusted blindly; preserve verification/idempotency protections.
- Payment attempts and business-level financial state remain distinct concepts.
- Historical financial documents should not be silently mutated to simulate adjustments.

## Events

Prefer durable event/history records for delivery, collection and financial state changes that matter to auditability.

## Customer account model

Customer 360 should be derived from authoritative invoices, payments, refunds, adjustments and collection events rather than maintaining duplicate mutable totals unless a proven performance requirement introduces snapshots/materialisation.

## Automation

All scheduled/automated actions must be replay-safe/idempotent and observable.

## RBAC

Extend the current matrix rather than inventing inconsistent role behavior. Viewer remains read-only. Sensitive refund/financial configuration actions remain restricted.

---

# DEMO DATA REQUIREMENTS

As each task lands, update seed/demo data so the new feature can be demonstrated without manual setup.

The finished demo should include at least:

- Paid customer.
- Healthy open customer.
- Overdue customer.
- Partially paid invoice.
- Overpaid/refunded case.
- Recurring invoice series.
- Delivered/viewed invoice.
- Automated reminder history.
- Customer with active promise to pay.
- Broken promise case.
- Customer statement with multiple transactions.
- Later: dispute and cash-application exception.
