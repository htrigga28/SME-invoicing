# T020 — Codex Implementation Prompt

Use this prompt to start the first Lumina v2 implementation task immediately.

> **Interface note:** This document remains authoritative for T020 behavior and domain rules. The current `apps/web` interface is superseded by `06_APP_DESIGN_OVERHAUL.md` and its Clear Financial Workspace direction.

---

You are implementing **T020 — Invoice Experience 2.0** in the repository `htrigga28/SME-invoicing`.

Do not start with another planning exercise. Read the required source-of-truth documents, inspect the current codebase, inspect the referenced Mobbin flows, then implement the feature as a complete vertical slice.

## Required reading

Read, in order:

1. `docs/lumina-v2/00_BUILD_BRIEF.md`
2. `docs/lumina-v2/01_FEATURE_AND_BUILD_SEQUENCE.md`
3. `docs/lumina-v2/02_UI_UX_DIRECTION.md`
4. `docs/lumina-v2/03_CODEX_EXECUTION_GUIDE.md`
5. `docs/codex-task-board.md`
6. Existing relevant invoice/domain docs only as needed:
   - `docs/product-spec.md`
   - `docs/database-schema.md`
   - `docs/api-contracts.md`
   - `docs/status-rules.md`
   - `docs/rbac-matrix.md`
   - `docs/design-system.md`
   - `docs/design-direction.md`

## Mobbin research — required before UI implementation

Use the Mobbin MCP to inspect these references directly:

- Stripe invoice creation:
  https://mobbin.com/flows/03c71446-31eb-497b-b715-3419cf90933ea
- Mercury invoice creation:
  https://mobbin.com/flows/ef4623ce-bc68-4006-9c98-f720a4546769
- Airwallex invoice creation:
  https://mobbin.com/flows/45967791-df7e-43f8-954a-4c45b5e30e20
- Midday invoice list:
  https://mobbin.com/screens/f2a4a414-3111-4357-a01c-0cb2933ecb92

Important: if the Stripe flow URL above fails because of an ID mismatch, use the canonical Stripe flow URL recorded in `docs/lumina-v2/02_UI_UX_DIRECTION.md` instead. Treat that document as authoritative.

Study hierarchy, progressive disclosure, invoice preview, line-item editing, action placement, desktop/mobile behavior and information density. Do not clone any product literally.

## Goal

Make invoice creation and invoice management feel like modern production financial software rather than an MVP form.

The implementation must introduce:

### Product/service catalogue

Create the minimum coherent organisation-scoped catalogue needed for reusable invoice line items.

Support at minimum:

- name;
- description;
- default unit price;
- active/archive state if appropriate;
- created/updated timestamps;
- organisation scope.

Use current money conventions and integer minor units.

A user must be able to:

- manage reusable catalogue items;
- select a catalogue item during invoice creation;
- override description/quantity/price on the invoice without mutating the source catalogue item;
- still create ad-hoc line items not linked to the catalogue.

Do not create a full inventory system.

### Invoice metadata improvements

Add the minimum metadata required by the new authoring UX, including:

- customer-facing reference / PO number;
- customer-facing memo/note;
- improved due-date/payment-term selection;
- internal note only if it can be clearly separated from public invoice data.

Preserve all existing status and financial rules unless a required schema change explicitly extends them.

### Invoice authoring redesign

Desktop should use an editor + live invoice preview layout inspired by Stripe/Mercury/Airwallex.

Requirements:

- customer selector;
- invoice metadata;
- catalogue/ad-hoc line-item editor;
- discounts/tax as supported by current domain logic;
- terms/due date;
- memo;
- clear draft/send actions;
- live customer-facing preview;
- responsive behavior;
- mobile Preview action/full-screen view rather than squeezed two-column layout.

The preview must never display internal-only fields.

It may calculate optimistically for responsiveness, but authoritative totals/state must still come from backend/domain logic.

### Invoice duplicate action

Add a safe duplicate workflow from a sensible invoice context.

The duplicate should:

- create a new draft;
- use a new invoice number according to existing numbering rules;
- copy appropriate customer, line-item and invoice configuration data;
- not copy payment state, receipt state, provider references, public token identity or lifecycle history.

### Invoice list/detail polish

Update invoice list/detail only as necessary to make the new authoring experience coherent.

Show useful new metadata without overloading the pages.

Do not turn this task into a full redesign of unrelated routes.

## Architecture constraints

Do not rewrite the application.

Preserve:

- organisation isolation;
- RBAC;
- Paystack payment flow;
- reconciliation logic;
- overpayment/refund logic;
- receipt immutability;
- audit behavior;
- server-authoritative totals;
- current public invoice security boundaries.

Inspect existing services and shared components before adding parallel implementations.

Keep NestJS as a modular monolith.

## Testing

Add/update tests for at least:

- catalogue tenant isolation;
- catalogue validation;
- invoice creation from catalogue items;
- ad-hoc line items;
- duplicated invoice semantics;
- invoice totals/status regressions;
- RBAC around catalogue/invoice mutation;
- new public-vs-internal field boundaries where relevant.

Add focused frontend tests for high-value behavior where the repository's current test setup makes this practical.

## Seed/demo data

Update seed data with realistic Lumina demo content:

- several reusable products/services;
- one polished multi-line draft/sent invoice using the new fields;
- enough variation to demonstrate the catalogue picker and live preview.

Do not use placeholder names such as Product 1 unless existing seed conventions require them.

## Browser QA

Use browser/computer tooling to inspect the completed UI at approximately:

- 1440px desktop;
- 1280px laptop;
- 768px tablet;
- 390px mobile.

Verify:

- invoice editor/preview proportions;
- long item descriptions;
- many line items;
- large NGN totals;
- validation states;
- loading/empty/error states;
- mobile item editing;
- preview correctness;
- draft creation;
- send flow;
- public invoice still renders correctly;
- an invoice created with the new flow can still proceed through the existing payment path.

Compare the finished hierarchy against the Mobbin references, but keep Lumina visually distinct.

## Documentation and task tracking

Before implementation, add T020 to `docs/codex-task-board.md` as In Progress using an appropriate task branch.

After implementation:

- update T020 status appropriately;
- update only existing domain/design docs that became inaccurate;
- do not write speculative docs for T021+;
- include validation and QA results in the PR/implementation report.

## Validation

Run the repository's normal validation commands, including relevant:

- typecheck;
- lint;
- tests;
- builds where appropriate.

Fix regressions introduced by this task.

## Scope guard

Do **not** add in T020:

- recurring invoices;
- automated reminder jobs;
- customer portal;
- credit/debit notes;
- collections queue;
- promise to pay;
- NRS e-invoicing;
- multi-currency;
- multiple payment-provider support.

Those are intentionally sequenced later.

## Completion standard

Do not report completion because the schema or UI shell exists.

T020 is complete only when a user can create a polished real-world invoice using reusable catalogue items or ad-hoc lines, see an accurate live preview, save/send it through existing Lumina behavior, duplicate it safely, use the experience on mobile, and continue into the existing public payment/reconciliation flow without regressions.
