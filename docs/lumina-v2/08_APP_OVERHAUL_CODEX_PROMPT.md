# Lumina v2 — Codex Prompt: Full App Design Overhaul

Use this prompt to execute the authenticated-product overhaul.

---

You are performing a **full UI/UX overhaul of Lumina's `apps/web` application** in `htrigga28/SME-invoicing`.

This is an implementation task, **not another design-planning task**.

The visual decision is already made: Lumina's product is moving from the current dark fintech command-center treatment to a **light, calm, precise financial workspace**.

## Required reading

Read before editing code:

1. `docs/lumina-v2/00_BUILD_BRIEF.md`
2. `docs/lumina-v2/06_APP_DESIGN_OVERHAUL.md` — authoritative for `apps/web` visual direction
3. `docs/lumina-v2/07_MOBBIN_APP_REFERENCE_LIBRARY.md` — authoritative reference library
4. `docs/lumina-v2/02_UI_UX_DIRECTION.md` — product interaction principles where not superseded by 06
5. `docs/lumina-v2/03_CODEX_EXECUTION_GUIDE.md`
6. `docs/status-rules.md`
7. `docs/rbac-matrix.md`
8. Relevant feature/domain docs only as needed

Treat the old dark portions of `docs/design-system.md`, `docs/design-direction.md` and T017 as **superseded visual direction**. Their domain/accessibility/workflow guidance still applies where compatible.

`docs/lumina-v2/05_MARKETING_SITE_REDESIGN.md` is for `apps/marketing`; do not redesign marketing in this task.

---

# 1. First inspect the actual application

Before changing code:

- inspect the current `apps/web` source tree;
- inspect `globals.css`;
- inspect AppShell, Sidebar, Topbar, navigation and page primitives;
- inspect shared UI primitives;
- inspect Dashboard;
- inspect Invoice list/create/detail;
- inspect Customer list/detail;
- inspect Payments/reconciliation;
- inspect Receipts;
- inspect Team, Payment Setup, Exports, Audit Logs;
- inspect auth/onboarding;
- inspect public invoice/receipt;
- inspect current tests and build scripts.

Confirm the current working branch/state before editing. Do not overwrite unrelated user changes.

Capture baseline browser screenshots of flagship routes if the environment permits.

---

# 2. Use Mobbin MCP actively

Do not treat the Mobbin links as passive documentation.

Use the Mobbin MCP and open the primary references in `07_MOBBIN_APP_REFERENCE_LIBRARY.md` before each flagship surface.

At minimum inspect:

### App shell / dashboard

- Mercury dashboard
- Stripe dashboard
- Airwallex dashboard
- Xero overview

### Invoice list

- Mercury invoicing list
- Midday master-detail invoicing
- Airwallex invoice list
- Deel invoice/payables table

### Invoice creation

- Stripe Creating an invoice
- Mercury Creating an invoice
- Airwallex Creating an invoice
- Acctual Creating an invoice

### Customer

- Wave customer detail
- Xero customer/contact account
- Stripe customer detail

### Payments

- Mercury transactions
- Stripe payments/transactions
- Midday transaction master-detail
- Acctual payments

### Settings

- Resend
- Sentry
- Sprig

### Public invoice

- Mercury hosted invoice
- Midday invoice
- Stripe invoice preview
- Acctual invoice view
- PayPal invoice

### Onboarding

- Mercury onboarding
- Airwallex business-profile onboarding
- Melio account setup

For each area, identify what you are borrowing: hierarchy, density, action placement, form organization, table behavior, detail drawers, document preview, spacing or responsive behavior.

Do not clone another app literally.

---

# 3. Implementation objective

By the end of this task, `apps/web` must feel like one coherent light-mode financial product.

It must **not** look like the existing dark app with white tokens substituted.

You are expected to improve:

- visual system;
- shell/navigation;
- information hierarchy;
- table ergonomics;
- filter ergonomics;
- action hierarchy;
- document/invoice presentation;
- customer-facing payment experience;
- mobile behavior;
- consistency across routes.

Do not change financial/business semantics merely for visual similarity to a reference.

---

# 4. Execute in passes

## Pass A — design-system foundation

Update `apps/web/src/app/globals.css` and shared primitives first.

Required outcomes:

- light root color scheme;
- new light semantic token set based on `06_APP_DESIGN_OVERHAUL.md`;
- deep green primary action color;
- lime demoted to rare highlight role;
- independent success/warning/danger/info tokens;
- light chart tokens;
- light topbar/sidebar/surface tokens;
- neutral borders;
- restrained shadows;
- print mode preserved;
- `prefers-reduced-motion` preserved.

### Remove the old migration hack

The existing `@media not print` compatibility layer globally remaps `bg-white`, slate colors, teal states, shadows, form colors and table colors into the dark theme.

Do not replace it with a reverse global utility remapper.

Instead:

1. update shared primitives to semantic tokens;
2. migrate feature pages away from legacy route-local palette classes;
3. delete/reduce compatibility overrides as routes become clean.

Search the whole `apps/web` tree for legacy `slate`, `zinc`, `teal`, dark surface and old lime-glow classes and deliberately migrate them.

### Shared primitives

Refactor/reuse before adding duplicates:

- Button / LinkButton / IconButton;
- Card / SectionCard / MetricCard;
- Input / Select / Textarea / DateInput;
- StatusBadge;
- Alert / Empty / Loading states;
- DataTable / Pagination;
- FilterBar or replacement data toolbar;
- typography;
- page layout/header.

Add reusable accessible primitives only where needed:

- Dropdown/overflow action menu;
- Drawer/Sheet;
- compact DataToolbar;
- Tabs if a shared primitive does not already exist;
- User/account menu.

Do not introduce a large UI framework just for this redesign unless the existing stack clearly requires it.

---

## Pass B — shell and navigation

Redesign:

- AppShell;
- Sidebar;
- Topbar;
- mobile navigation;
- page container rhythm.

### Sidebar target

- light/white quiet sidebar;
- subtle border;
- no neon glow;
- active item = soft green background / dark green text or small indicator;
- current RBAC visibility preserved;
- current real routes only;
- approximately 232–248px expanded desktop width;
- compact mode may remain if it still feels intentional.

### Current navigation grouping

Use a structure close to:

```text
Overview

RECEIVABLES
  Invoices
  Customers
  Payments
  Receipts

OPERATIONS
  Exports

SETTINGS
  Payment setup
  Team
  Audit log
```

Do not expose future/unbuilt routes.

### Topbar target

Move toward:

```text
[mobile menu]  [Search / jump to]                       [Help] [Account]
```

User role/logout belong inside account controls rather than permanently occupying the bar.

Do not add fake notifications/help functionality; if those systems do not exist, omit or use only real controls.

### Create invoice action

Remove or demote the desktop floating Create Invoice quick action if it fights the new hierarchy.

Use contextual primary actions in page headers.

---

## Pass C — flagship workflows

Implement these in order so later pages reuse the established patterns.

### C1 Dashboard / Overview

Use existing API data.

Target:

- 3–4 primary metrics: Outstanding, Overdue, Net collected, Needs attention;
- compact date-range control in page header/toolbar;
- large primary cashflow/collections visualization;
- actionable Needs Attention panel;
- aging view;
- recent meaningful activity;
- payment setup as contextual banner/state;
- fewer equal-size cards.

Do not add new backend metrics solely for this visual task.

### C2 Invoices list

- page header + New invoice;
- compact status navigation/tabs where supported;
- compact search/filter toolbar;
- table dominates page;
- right-aligned money;
- whole-row navigation where accessible;
- actions in `…` menu;
- mobile record rows/cards;
- keep real pagination/filter behavior.

### C3 Invoice create/edit

This is a flagship surface.

Use Stripe/Mercury/Airwallex/Acctual references.

Implement:

- editor + **true customer-facing invoice preview** on desktop;
- grouped, progressively disclosed fields;
- compact editable line-item structure rather than independent bordered item cards;
- strong Save/Create action hierarchy;
- preview based on the same customer-facing data model as public invoice;
- mobile preview sheet/full-screen mode;
- server-calculated totals remain authoritative.

Do not add the future product catalogue/recurring feature set unless it is already being implemented as part of the active T020 feature branch. If those features are not present, redesign the current fields without inventing them.

### C4 Invoice detail

- document/payment-trail composition;
- strong amount/status/due hierarchy;
- one contextual primary action;
- Edit/Cancel/Void/etc. in context/overflow as appropriate;
- readable lifecycle timeline;
- financial/payment/reconciliation truth remains explicit.

### C5 Payments / reconciliation

- compact summary strip;
- preserve Reconciliation / All attempts / Needs review segmentation;
- compact search/filter toolbar;
- data table dominates;
- detail drawer/master-detail when useful;
- Needs Review prioritizes reason + next action;
- preserve settlement/reconciliation distinctions.

### C6 Customers

Customer list:

- cleaner record table;
- row navigation;
- overflow actions;
- compact active/archive filter.

Customer detail:

- turn current invoice-summary data into the beginning of Customer 360;
- expose Invoiced / Paid / Balance due / Invoice count clearly;
- use tabs only for data that exists;
- invoice history is main working surface;
- contact information becomes compact rather than a dominant card.

---

## Pass D — supporting routes

Migrate the established system into:

- Receipts list/detail;
- Exports;
- Audit Logs;
- Team;
- Payment Setup.

Do not invent route-specific design systems.

### Settings

Create a coherent settings-area layout where practical, using only real routes.

### Audit

Keep dense and operational.

### Exports

Cards are acceptable because the user is choosing export tasks, not browsing transactional records.

---

## Pass E — public and entry flows

Redesign:

- public invoice;
- public receipt;
- login;
- registration;
- business onboarding;
- payment-setup onboarding;
- invite acceptance.

### Public invoice

Must be a premium light customer document/payment experience:

- merchant-led branding;
- amount due and due state visible immediately;
- clean document hierarchy;
- clear Pay button;
- responsive/mobile-first payment action;
- Paystack messages preserved accurately;
- Lumina as secondary infrastructure branding.

### Public receipt

Share the same customer-document visual grammar.

### Auth/onboarding

Use financial onboarding references but preserve Lumina's real Account → Business → Payments process.

---

## Pass F — cleanup and consistency

Before reporting completion:

- search for remaining legacy palette classes across `apps/web`;
- remove dead dark tokens/overrides;
- remove route-local duplicated PageHeader/button/table patterns where shared components now cover them;
- check that status mapping is centralized;
- check print styles;
- check all public pages without authenticated shell leakage;
- update `docs/design-system.md` and `docs/design-direction.md` to describe the actual implemented light system;
- update task board status/notes appropriately based on the branch/task conventions you find.

---

# 5. Typography rule

Keep Hanken Grotesk.

Keep JetBrains Mono for references/IDs.

Do **not** render every money value in mono purely because it is financial.

Use tabular numerals for aligned numerical values.

---

# 6. Motion rule

Product motion is functional, not cinematic.

Use 120–220ms transitions for:

- menus;
- drawers;
- row selection;
- preview changes;
- save success;
- small state changes.

Do not use marketing-style scroll animations inside `apps/web`.

Remove GSAP usage where a normal CSS transition is enough; do not remove the package if another route still needs it.

Honor reduced motion.

---

# 7. Theme rule

Light mode is the canonical theme for this implementation.

Do not block the overhaul on a dark/light toggle.

Keep semantic token architecture future-compatible with a possible dark theme later.

---

# 8. No-regression constraints

Do not change or weaken:

- auth/session behavior;
- onboarding gating;
- tenant isolation;
- RBAC;
- server-authoritative invoice totals;
- invoice status rules;
- public token security;
- Paystack bank/subaccount behavior;
- payment initialization;
- webhook verification/idempotency;
- payment reconciliation classifications;
- overpayment/refund behavior;
- immutable receipts;
- export safety;
- audit safety.

Do not change backend contracts just to match a visual reference.

---

# 9. Testing

Run the existing test suite throughout migration.

Add/update frontend tests where shared component or interaction behavior changes materially, especially:

- navigation/RBAC visibility;
- menus/drawers;
- invoice preview mapping;
- form action visibility;
- public invoice payment states;
- responsive logic where practical;
- destructive confirmation behavior.

Do not delete useful tests merely because markup changed.

---

# 10. Browser QA

Use browser/computer tooling and inspect at minimum:

- 1440px;
- 1280px;
- 1024px;
- 768px;
- 390px.

Flagship routes to review:

- `/dashboard`
- `/invoices`
- `/invoices/new`
- at least one invoice detail
- `/customers`
- at least one customer detail
- `/payments`
- `/receipts`
- `/settings/payment-setup`
- `/settings/team`
- public invoice
- public receipt
- login/register/onboarding

Test realistic state variation:

- long names;
- large amounts;
- overdue;
- partial payment;
- paid;
- overpaid/review required;
- empty list;
- loading;
- API error;
- disabled/verification-delayed setup;
- mobile line items;
- mobile public payment.

Take screenshots and compare against the Mobbin references for hierarchy and density.

Do not attempt to reproduce reference pixels exactly.

---

# 11. Validation

Run appropriate repository validation, including:

- `pnpm`/workspace typecheck;
- lint;
- frontend tests;
- build;
- any broader repository checks required by the existing project conventions.

Fix regressions introduced by the overhaul.

---

# 12. Completion report

When finished, report:

1. files/areas changed;
2. design-system changes;
3. routes migrated;
4. Mobbin references actually used and what was borrowed from each;
5. before/after UX improvements;
6. accessibility/responsive changes;
7. tests/validation run;
8. browser QA sizes/states checked;
9. any remaining legacy styles/routes;
10. any product features deliberately deferred because they belong to T020+ rather than this visual overhaul.

Do not report the overhaul as complete if only tokens and the shell were changed. The primary financial workflows must visibly use the new system.
