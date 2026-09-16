# Lumina v2 — Codex Execution Guide

**Status:** APPROVED FOR IMPLEMENTATION  
**Audience:** Codex / coding agent working in `htrigga28/SME-invoicing`

## 1. Read Order Before Starting Any Lumina v2 Task

Read:

1. `docs/lumina-v2/00_BUILD_BRIEF.md`
2. `docs/lumina-v2/01_FEATURE_AND_BUILD_SEQUENCE.md`
3. `docs/lumina-v2/02_UI_UX_DIRECTION.md`
4. The current task entry in `docs/codex-task-board.md`
5. Relevant existing docs only as needed:
   - `docs/product-spec.md`
   - `docs/database-schema.md`
   - `docs/api-contracts.md`
   - `docs/status-rules.md`
   - `docs/rbac-matrix.md`
   - `docs/design-system.md`
   - `docs/design-direction.md`

Do not spend a separate task rewriting all legacy planning documents before implementation.

## 2. General Working Mode

For each task:

1. Inspect the current code first.
2. Identify existing reusable components, services, domain rules, tests and schema.
3. Inspect the linked Mobbin references for that task before designing flagship UI.
4. Implement the smallest coherent vertical slice.
5. Add/adjust migrations carefully.
6. Update seed/demo data.
7. Add tests around financial/domain behavior and important UI interactions.
8. Run repository validation.
9. Perform browser QA at desktop and mobile sizes.
10. Update `docs/codex-task-board.md` and any authoritative domain docs affected by the implementation.
11. Commit with a clear task-scoped message.

Do not stop after scaffolding if the task can be made fully demoable in the same implementation cycle.

## 3. No-Rewrite Rule

Do not replace working financial logic simply to make code look cleaner.

Preserve and build around:

- payment webhook verification;
- reconciliation classifications;
- successful payment truth;
- refund and overpayment handling;
- immutable receipts;
- server-calculated invoice totals;
- organisation/tenant isolation;
- RBAC;
- safe public invoice/receipt access;
- audit logs;
- export safety.

Refactor only when necessary to enable new functionality, and prove parity with tests.

## 4. Architecture Direction

Keep the NestJS modular monolith.

As new capability appears, create clearer domain modules rather than making existing services infinitely large.

Likely domain boundaries over time:

```text
billing/
  invoices/
  catalogue/
  recurring/
  adjustments/

communications/
  delivery/
  templates/
  reminders/

collections/
  accounts/
  promises/
  tasks/

payments/
  providers/
  attempts/
  refunds/

cash-application/
  matching/
  exceptions/

customer-portal/

compliance/
```

Do not create empty modules for future features. Introduce a boundary when real implementation needs it.

## 5. Database Rules

Before adding a table or field:

- inspect current Drizzle schema;
- avoid duplicated mutable financial totals when values can safely be derived;
- use explicit event/history tables for meaningful lifecycle events;
- include organisation scoping on internal tenant data;
- include indexes for expected list/filter paths;
- use database constraints for important invariants where practical;
- preserve migration compatibility with current seeded/demo environments.

For event records, consider actor/source, timestamp, entity linkage and safe metadata, but avoid arbitrary raw provider payload exposure.

## 6. API Rules

- Keep contracts explicit and typed.
- Validate DTOs.
- Enforce tenant context server-side.
- Never trust client-submitted organisation IDs as authorization.
- Return business-meaningful state rather than forcing frontend code to reconstruct financial truth.
- Preserve pagination/filter conventions where sensible.
- Add Swagger/API docs for new public/internal endpoints.

## 7. Automation Rules

Scheduled jobs/reminders/recurring invoices must be durable.

Do not use:

- `setInterval` as business scheduling infrastructure;
- process-local memory for durable state;
- fire-and-forget operations with no retry/observability.

Before choosing queue infrastructure, inspect actual hosting/deployment constraints.

Choose the simplest reliable architecture, for example:

- Postgres-backed job/schedule records + secured cron runner; or
- BullMQ/Redis if the runtime already supports a durable worker economically and reliably.

Required properties:

- idempotency;
- retry safety;
- visible failure state;
- deterministic next-run calculation;
- no duplicate invoice generation/reminder sending under concurrent execution.

## 8. UI Implementation Rules

### Before coding a flagship page

Use Mobbin MCP and inspect the linked references in `02_UI_UX_DIRECTION.md`.

For T020 specifically inspect:

- Stripe invoice creation flow.
- Mercury invoice creation flow.
- Airwallex invoice creation flow.
- Midday invoice list.

### Do not clone references

Use them to understand:

- hierarchy;
- progressive disclosure;
- density;
- editor/preview relationships;
- table behavior;
- actions;
- states.

Apply Lumina's own product model and brand.

### Existing component system

Reuse/refactor shared primitives before introducing parallel route-local variants.

If the product transitions to a light default workspace:

- evolve semantic tokens rather than hardcoding a second palette through pages;
- keep marketing app styling independent;
- avoid breaking public print views;
- if both themes exist, tokens must define the relationship cleanly.

## 9. Browser QA Requirements

Every flagship UI task must be inspected manually in the browser at minimum:

- desktop approximately 1440px;
- laptop approximately 1280px;
- tablet approximately 768px;
- mobile approximately 390px.

Check:

- overflow;
- sticky/fixed elements;
- keyboard focus;
- loading/empty/error states;
- long customer/business names;
- large NGN values;
- many line items;
- overdue/partial/overpaid states;
- destructive actions;
- public pages without authenticated shell leakage.

Take screenshots during review when useful, particularly when comparing against Mobbin references.

## 10. Testing Expectations

Prioritize tests where mistakes are expensive.

### Backend

Add/update tests for:

- tenant isolation;
- RBAC;
- invoice calculations;
- status/lifecycle transitions;
- job idempotency;
- reminder/recurrence deduplication;
- communication event creation;
- public token access boundaries;
- payment/reconciliation regressions.

### Frontend

Test:

- important form validation;
- permissions/action visibility;
- flagship workflow transitions;
- critical empty/error states;
- invoice preview data mapping where practical.

Use end-to-end/browser tests selectively for the most important flow rather than attempting exhaustive UI automation for every component.

## 11. Documentation Rule

Documentation changes should follow implementation.

When a task changes real behavior, update the exact docs that become inaccurate.

Do not spend time creating speculative documentation for features not built yet.

The `docs/lumina-v2/` package is the future-direction source of truth; legacy MVP docs continue to describe currently implemented behavior until the relevant feature lands.

## 12. T020 Start Instructions

T020 is the immediate next feature task.

Before coding:

- inspect current invoice create/edit/detail pages;
- inspect invoice DTO/service/schema;
- inspect reusable form/table/card primitives;
- inspect any current PDF/print/public-invoice markup that can inform the live preview;
- inspect Mobbin invoice references;
- identify the minimal catalogue schema and API needed.

Then implement a cohesive vertical slice that includes:

### Backend

- product/service catalogue domain;
- organisation-scoped CRUD appropriate for invoice authoring;
- invoice reference/PO and memo fields required by the selected UX;
- duplicate-invoice operation or safe frontend workflow backed by existing create behavior;
- any required migrations;
- tests.

### Frontend

- Products & Services route if needed for catalogue management;
- revised invoice authoring UI;
- catalogue item picker;
- ad-hoc item support;
- live customer-facing preview on desktop;
- mobile preview interaction;
- richer metadata/terms UI;
- duplicate action from invoice detail/list where appropriate;
- loading/empty/error/success states.

### Do not expand T020 into

- recurring invoice scheduling;
- automated reminders;
- customer portal;
- credit notes;
- NRS;
- multiple payment providers.

Those have their own tasks.

## 13. T020 Acceptance Checklist

T020 is not complete until:

- existing invoice creation still works end-to-end;
- catalogue items are reusable and tenant-isolated;
- ad-hoc invoice line items still work;
- preview accurately reflects customer-visible invoice data;
- totals remain authoritative and correct;
- draft/send status behavior has not regressed;
- invoice list/detail expose the new metadata coherently;
- mobile authoring is usable;
- existing payment flow still works on an invoice produced by the new authoring experience;
- typecheck/lint/tests pass;
- relevant browser QA passes;
- demo seed data includes catalogue items and a polished representative invoice;
- task board/docs are updated.

## 14. Decision Rule When Something Is Ambiguous

Prefer, in this order:

1. Financial correctness and security.
2. Current authoritative implemented behavior.
3. Simpler user workflow.
4. Simpler architecture.
5. Visual polish.

If a design reference conflicts with Lumina's business rules, preserve Lumina's business rules and adapt the design pattern.
