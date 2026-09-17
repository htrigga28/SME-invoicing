# Lumina v2 — Current App UI Audit

**Status:** IMPLEMENTATION CONTEXT  
**Audit branch:** `dev`  
**Audit date:** 2026-09-17  
**Purpose:** Give Codex an explicit map from the current `apps/web` implementation to the new light design direction so it does not need to rediscover the same structural issues.

Companion docs:

- `06_APP_DESIGN_OVERHAUL.md`
- `07_MOBBIN_APP_REFERENCE_LIBRARY.md`
- `08_APP_OVERHAUL_CODEX_PROMPT.md`

---

## 1. Root styling

### `apps/web/src/app/globals.css`

Current state:

- `color-scheme: dark` is set at `:root`.
- Canvas/surfaces are near-black.
- Brand accent is neon lime.
- Success uses the same lime family.
- Topbar/backdrop tokens assume dark surfaces.
- A large `@media not print` compatibility layer globally remaps legacy Tailwind utility classes into dark tokens.
- `bg-white`, slate backgrounds, slate text, teal/green states, borders, shadows, inputs and tables are all intercepted globally.
- Shadows are broadly disabled.
- Print mode separately forces light output.

Risk:

A simple root-token swap will produce inconsistent results because old route-local classes and the compatibility remapper will fight one another.

Required migration:

1. establish light semantic tokens;
2. update shared primitives;
3. migrate feature-level legacy palette classes;
4. delete the global dark utility remapping;
5. preserve print behavior explicitly.

---

## 2. Fonts and root layout

### `apps/web/src/app/layout.tsx`

Current:

- Hanken Grotesk loaded via `next/font`.
- JetBrains Mono loaded via `next/font`.
- Sonner toaster mounted globally.

Decision:

Keep both fonts.

Change usage rather than font families:

- Hanken for normal UI and money;
- tabular numerals for financial alignment;
- JetBrains Mono mainly for identifiers/references.

---

## 3. App shell

### `apps/web/src/components/layout/app-shell.tsx`

Current:

- sidebar state persisted in localStorage;
- 80px collapsed / 256px expanded model through main-content padding;
- 1600px max working canvas;
- sticky Topbar;
- global floating Create Invoice quick action;
- payment-setup onboarding uses a separate focused shell;
- loading state already has skeleton-like placeholders.

Preserve:

- authentication/session flow;
- `getMe` cache;
- onboarding redirects;
- RBAC access behavior;
- focused payment-setup onboarding shell.

Redesign:

- light shell;
- calmer sidebar geometry;
- simpler top utility bar;
- contextual Create Invoice actions rather than a desktop-global floating action;
- keep responsive behavior but change presentation.

---

## 4. Sidebar

### `apps/web/src/components/layout/sidebar.tsx`

Current:

- dark `background-deep`;
- 80/256px collapsible layout;
- lime active state;
- active item adds a large accent glow;
- group labels Main / Settings;
- tooltip for compact mode.

Keep:

- Lucide icons;
- role-filtered route generation;
- accessible labels/tooltips;
- optional collapse behavior if still useful.

Change:

- white/pale sidebar;
- no glow;
- soft selected row + deep-green text/icon;
- quieter section labels;
- better route grouping around Receivables / Operations / Settings.

---

## 5. Topbar

### `apps/web/src/components/layout/topbar.tsx`

Current:

- shows business name;
- shows user name/email;
- role chip;
- visible Logout button;
- mobile nav expands into a grid underneath the bar;
- dark translucent/blurred background.

Change:

- light topbar;
- move role/logout into account menu;
- leave room for search/jump command;
- mobile navigation should become a dedicated drawer/sheet rather than a grid under the header;
- do not add fake notifications/help systems.

---

## 6. Navigation

### `apps/web/src/components/layout/navigation.ts`

Current real routes:

- Dashboard;
- Customers;
- Invoices;
- Payments;
- Receipts;
- Exports;
- Audit Logs;
- Team;
- Payment Setup.

RBAC visibility is already encoded.

Recommended current grouping:

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

Do not add future modules to navigation before implementation.

---

## 7. Shared page primitives

### `apps/web/src/components/layout/page.tsx`

Current:

- shared PageContainer;
- PageHeader;
- PageActions;
- Section / SectionHeader.

Good foundation.

Issue:

Several domains still expose their own `PageHeader` wrappers/helpers.

Migration:

Use shared layout primitives as the final source of truth where possible; remove domain duplication after routes are migrated and tests pass.

---

## 8. Typography primitives

### `apps/web/src/components/ui/typography.tsx`

Current:

- DisplayMetric is monospaced;
- MoneyText is monospaced;
- ReferenceText is monospaced;
- Page/Section/Body primitives exist.

Change:

- DisplayMetric and MoneyText should use Hanken + tabular numerals by default;
- ReferenceText remains mono;
- reduce uppercase micro-label use;
- preserve accessible hierarchy.

---

## 9. Buttons

### `apps/web/src/components/ui/button.tsx`

Current architecture is good:

- primary;
- secondary;
- outline;
- ghost;
- destructive;
- loading state;
- LinkButton;
- IconButton.

Redesign mainly through tokens/classes:

- deep-green primary;
- soft-green secondary;
- neutral outline;
- restrained destructive;
- no glow.

Avoid creating route-specific button systems.

---

## 10. Forms

### `apps/web/src/components/ui/form.tsx`

Current architecture is reusable.

Current controls use semantic variables but dark raised surfaces.

Change:

- white/light inputs;
- neutral border;
- deep-green focus;
- keep 40–44px minimum target;
- DateInput should not automatically require mono styling unless useful.

Several older feature pages still use raw `<input>` and slate classes. Migrate them onto shared controls during route work.

---

## 11. Cards

### `apps/web/src/components/ui/card.tsx`

Existing Card/SectionCard/MetricCard system should be retained.

Change:

- remove accent glow emphasis;
- use cards less frequently;
- allow flat page sections/table shells where grouping is already obvious.

---

## 12. Data tables

### `apps/web/src/components/ui/data-table.tsx`

Strong current foundation:

- DataTableContainer;
- DataTableToolbar;
- DataTable;
- sticky TableHeaderCell;
- MobileDataCard;
- Pagination.

Change:

- light white table shell;
- quiet sticky header;
- 44–52px operational row height;
- soft hover/selected state;
- title/sentence-case headers where clearer;
- whole-row navigation;
- shared overflow action menu;
- right-align financial columns;
- reduce permanent row buttons.

Potential additions:

- DataToolbar;
- TableRowActionMenu;
- selected-row state;
- reusable detail drawer integration.

---

## 13. Filters

### `apps/web/src/components/ui/filter-bar.tsx`

Current:

- full bordered card;
- labelled field grid;
- explicit FilterActions block.

Problem:

This consumes substantial vertical space on every list.

Direction:

Replace/extend with compact data toolbar patterns:

- search;
- status tabs/segmented control;
- filter buttons/selects;
- advanced filter popover/drawer;
- clear filters;
- export/action on right.

Keep the existing FilterBar only where a genuine multi-field form is clearer.

---

## 14. Status badges

### `apps/web/src/components/ui/status-badge.tsx`

Current centralized status-to-tone mapping is valuable and should remain.

Change only visual tokens:

- success independent from brand;
- soft light backgrounds;
- strong text contrast;
- no state communicated by color alone.

---

# 15. Dashboard

### `apps/web/src/features/dashboard/dashboard-shell.tsx`

Current page contains:

- standalone Reporting Period card;
- attention region;
- first row of 4 metric cards;
- payment setup panel;
- second row of 4 metric cards;
- Cashflow Trend card;
- Invoice Status chart;
- Outstanding Aging chart;
- Recent Invoices card;
- Recent Payments card;
- Recent Receipts card;
- Review Issues card.

Current available data already supports a significantly stronger overview without API changes.

Problems:

- too many equal-weight cards;
- reporting-period controls consume too much space;
- recent information is fragmented into multiple panels;
- chart/data priority is unclear;
- a GSAP entrance exists for AttentionRegion even though simple product motion would suffice.

Target:

- 4 primary metrics max;
- header-level date range;
- large cashflow/collections panel;
- Needs Attention panel;
- aging panel;
- unified recent activity;
- payment setup as contextual alert.

Existing Recharts components can be retained/restyled.

---

# 16. Invoice list

### `apps/web/src/features/invoices/invoice-list-page.tsx`

Current:

- PageHeader;
- card FilterBar;
- search + status + customer filters;
- table: Invoice / Customer / Issue / Due / Total / Balance / Status / Actions;
- permanent View button;
- mobile cards.

Target:

- status-first workflow controls;
- compact search/filter toolbar;
- table dominant;
- whole-row link;
- overflow row actions;
- clear due/balance/status hierarchy;
- retain real search/customer/status filtering and pagination.

---

# 17. Invoice create/edit

### `apps/web/src/features/invoices/invoice-form-page.tsx`

Current:

- `xl:grid-cols-[1fr_320px]`;
- left = one large form card;
- customer, issue/due date;
- line items as individual bordered mini-panels;
- discount/tax;
- notes;
- Cancel/Create action row;
- right = 320px totals-only Preview;
- GSAP used for line-item/preview micro animation.

Core opportunity:

The page already has the correct structural starting point for editor + preview, but the preview must become a **real customer-facing document**, not a totals card.

Target:

- approximately 44/56 or 48/52 editor/document split;
- compact editable line-item table/grid;
- true invoice preview;
- sticky/clear Save/Create/Send hierarchy according to current workflow;
- preview sheet on mobile/tablet;
- server totals remain authoritative;
- future catalogue can plug into line-item editor without redesigning it again.

---

# 18. Invoice detail

### `apps/web/src/features/invoices/invoice-detail-page.tsx`

Current:

- PageHeader + Back link;
- metadata/status card;
- visible Edit / Send / Cancel / Void controls;
- line-item table card;
- status timeline card;
- financial/payment sections further down.

Problems:

- actions compete equally;
- information is fragmented across multiple bordered panels;
- document and payment trail are not visually unified.

Target:

- high-information header with number/status/customer/balance/due;
- one contextual primary action;
- overflow for secondary/destructive actions;
- document/financial surface left;
- lifecycle/payment trail right;
- preserve payment/reconciliation detail.

---

# 19. Customers list

### `apps/web/src/features/customers/customer-list-page.tsx`

Current:

- PageHeader;
- Search + Status FilterBar;
- table: Customer / Phone / Status / Created / Actions;
- permanent View / Edit / Archive button cluster;
- mobile cards.

Target:

- compact active/archived control;
- compact search;
- row navigation;
- overflow actions;
- do not invent AR metrics that current endpoint does not provide.

---

# 20. Customer detail

### `apps/web/src/features/customers/customer-detail-page.tsx`

Current:

- 360px contact card;
- invoice-history panel;
- invoice summary already provides:
  - invoice count;
  - total invoiced;
  - total paid;
  - total balance due;
- invoice-history table;
- archive warning/action.

Opportunity:

This endpoint already supports a credible first Customer 360 design.

Target:

- customer identity header;
- Invoiced / Paid / Balance due / Invoice count summary strip;
- Overview/Invoices tabs only if useful;
- invoice history becomes main content;
- contact details compact rail/summary;
- future Payments/Statements/Promises tabs added only when backed by real data.

---

# 21. Payments / reconciliation

### `apps/web/src/features/payments/payments-page.tsx`

Current:

- four summary cards;
- SegmentedControl: Reconciliation / All attempts / Needs review;
- large filter card with search/status/reconciliation/date range;
- wide operational table;
- review events below.

Strong domain model must be preserved.

Target:

- compact summary strip;
- preserve segmented views;
- compact data toolbar;
- table dominant;
- optional right-side detail drawer;
- Needs Review view prioritizes reason/action;
- review events integrated into context rather than detached lower card.

---

# 22. Receipts

### `apps/web/src/features/receipts/receipts-page.tsx`

Current:

- Search / refund state / date range card;
- wide table with Receipt / Invoice / Customer / Payment reference / Amount / Refund state / Issued / Action;
- mobile cards.

Target:

Use the same table/filter/action grammar as Payments and Invoices.

Payment reference can become secondary on narrower desktop; core hierarchy is receipt/customer/invoice/amount/refund state/issued.

---

# 23. Public invoice

### `apps/web/src/features/public-invoices/public-invoice-page.tsx`

Current behavior is strong:

- loads public invoice;
- tracks view;
- handles Paystack payment initialization;
- verifies callback;
- polls when callback has no reference;
- displays pending/failed/success states.

Current visual structure:

- white article;
- dark slate header;
- separate balance due box;
- body document left;
- Summary + Payment cards right;
- Powered by Lumina footer.

Do **not** alter payment behavior.

Target visuals:

- warm light page;
- merchant identity + invoice context;
- amount due/due date/status immediately readable;
- integrated document body;
- deep-green Pay CTA;
- reduced box-within-box feel;
- mobile amount/Pay CTA high on page;
- Lumina secondary branding.

---

# 24. Auth

### `apps/web/src/features/auth/auth-card.tsx`

Current:

- centered max-w-md card;
- brand logo;
- title/description;
- form.

This structure is acceptable and should not be overcomplicated.

Target:

- intentional warm/light canvas;
- refined spacing/type;
- excellent fields and feedback;
- optional restrained desktop visual area only if it improves brand/trust.

---

# 25. Onboarding

### `apps/web/src/features/onboarding/onboarding-progress.tsx`

Current real steps:

- Account;
- Business profile;
- Payment Setup.

The component already exposes accessible current/completed/upcoming state.

Retain the three-step model.

Restyle into the new light system; do not add steps from references.

---

# 26. Payment Setup

### `apps/web/src/features/payment-setup/payment-setup-page.tsx`

Current implementation already models:

- loading account state;
- bank list;
- account resolution;
- resolved-account confirmation;
- creation/activation;
- disable/reactivate;
- delayed verification.

Target:

A high-trust setup/workflow screen rather than a generic settings/dashboard card collection.

Preserve all provider/business states.

---

# 27. Team

### `apps/web/src/features/team/team-management-page.tsx`

Current:

- members;
- invitations;
- role update;
- member removal;
- invitation creation/revocation;
- some old route-local action styles.

Target:

- shared Settings shell;
- compact invite flow;
- member table;
- pending invitations separated clearly;
- role/action menus consistent with rest of app.

---

# 28. Exports

### `apps/web/src/features/exports/exports-page.tsx`

Current datasets:

- customers;
- invoices;
- payments;
- receipts;
- audit logs (role restricted).

Cards/panels are appropriate here because each item is an operation rather than a financial record.

Restyle, but do not force this page into a data table.

---

# 29. Dependencies

### `apps/web/package.json`

Relevant existing libraries:

- Next 16;
- React 19;
- Tailwind 4;
- `lucide-react`;
- Recharts;
- Sonner;
- GSAP;
- Testing Library / Vitest.

No new animation library is required for the app overhaul.

Do not add a heavyweight UI framework solely for visual redesign unless a concrete accessibility/interaction need cannot reasonably be met with the existing component system.

---

# 30. Highest-risk migration points

1. **Removing dark utility remapping** — can expose dozens of legacy hardcoded classes.
2. **Public invoice/receipt print** — must remain clean and printable.
3. **Shell changes** — must not break onboarding and RBAC gating.
4. **Invoice form restructuring** — must not break validation or total calculations.
5. **Payments table/detail** — must not collapse distinct financial states.
6. **Responsive tables** — mobile cannot regress into overflow-only desktop layouts.
7. **Destructive actions** — archive/cancel/void/refund/disable confirmation must remain clear and accessible.

---

# 31. Implementation principle

Do not rewrite route behavior just because markup is old.

Use the existing code as the behavioral source of truth and replace its **presentation architecture** deliberately.

The best outcome is:

> existing financial correctness + current product depth + a new coherent, light, high-quality finance interface.
