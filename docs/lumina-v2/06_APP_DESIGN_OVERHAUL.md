# Lumina v2 — App Design Overhaul

**Status:** APPROVED FOR IMPLEMENTATION  
**Decision date:** 2026-09-17  
**Scope:** `apps/web` authenticated product, auth/onboarding, and public invoice/receipt surfaces.  
**Purpose:** Replace the current dark command-center treatment with a fresh light financial workspace grounded in the actual Lumina codebase and extensive Mobbin research.

---

## 1. Decision Summary

Lumina's authenticated product should receive a **full visual and interaction overhaul**.

The new direction is a **light, calm, precise financial workspace** designed to feel credible to small-business owners, accountants, finance managers, and larger receivables teams.

Working design name:

> **Clear Financial Workspace**

Core characteristics:

- light by default;
- financially trustworthy;
- calm rather than flashy;
- high information clarity;
- approachable enough for SMEs;
- sufficiently dense for finance teams;
- strong tables and workflow views;
- restrained brand color;
- minimal decorative chrome;
- explicit status and exception handling;
- responsive and mobile-capable;
- motion used only to clarify interaction.

This document **supersedes the dark visual direction from T017** and the old statement that dark mode is Lumina's product identity.

It does **not** supersede financial behavior, RBAC, tenancy, payment/reconciliation logic, status rules, audit rules, or other domain invariants.

For marketing, continue to use `docs/lumina-v2/05_MARKETING_SITE_REDESIGN.md`.

---

## 2. What the Current Code Tells Us

The redesign is not starting from a blank application. Lumina already has a capable frontend system and substantial product behavior.

### Existing strengths to preserve

- Semantic UI primitives already exist for buttons, cards, forms, tables, status badges, alerts, filters and pagination.
- Routes already expose meaningful financial states instead of cosmetic demo data.
- Dashboard data contains collection totals, outstanding balances, overdue balances, aging, review issues, recent invoices/payments/receipts and payment-setup state.
- Invoice, customer, payment, receipt and audit flows are already responsive enough to provide a migration foundation.
- Public invoice/payment pages are real transactional surfaces with Paystack payment and payment confirmation states.
- Hanken Grotesk and JetBrains Mono are already loaded with `next/font`.
- Recharts already powers financial visualization.
- GSAP is already available, though the product app should use it sparingly.

### Current design problems

#### A. Dark mode is hard-coded at the root

`apps/web/src/app/globals.css` currently sets `color-scheme: dark` and near-black background/surface tokens.

The app therefore cannot become genuinely light by only changing route-local components.

#### B. The global compatibility layer is doing too much

The current CSS globally remaps classes such as:

- `bg-white`;
- `bg-slate-*`;
- `text-slate-*`;
- `border-slate-*`;
- teal/green/amber/red utilities;
- shadows;
- table hover;
- form backgrounds.

This was useful for migrating a light MVP into a dark product, but it now makes the UI difficult to reason about.

The light overhaul should **retire this compatibility layer** and move affected routes to real semantic primitives/tokens.

#### C. Mixed styling systems remain

Some newer surfaces use semantic variables, while many feature pages still use hardcoded Tailwind color utilities such as `text-slate-950`, `bg-white`, `border-slate-200`, `text-teal-700`.

The overhaul must converge these approaches rather than adding another compatibility layer.

#### D. Too many equal-weight cards

The current dashboard and several settings/detail screens repeatedly use bordered cards of similar visual weight.

Financial products benefit from clearer hierarchy:

- one dominant working surface;
- compact metrics;
- tables/ledgers;
- side rails/drawers;
- timelines;
- only a few cards where grouping is meaningful.

#### E. Filters occupy too much vertical space

The current `FilterBar` is effectively a full card containing labelled form fields and an Apply button.

For data-heavy lists, move toward compact toolbars, search, status tabs, filter popovers/chips and URL-backed filter state where practical.

#### F. Action density is too visible

Customer and invoice rows often show permanent View/Edit/Archive buttons.

Use:

- clickable rows;
- one primary contextual action;
- overflow menus for secondary/destructive actions;
- detail drawers where useful.

#### G. Money is over-monospace

JetBrains Mono currently appears on many money values because `.font-mono` and tabular classes are paired frequently.

Use tabular numerals broadly, but reserve monospaced typography mainly for identifiers/references such as invoice numbers, receipt numbers and payment references.

---

## 3. Visual Foundation

### 3.1 Palette

The following is the starting design-token direction. Codex may make small accessibility-driven adjustments, but should preserve the character.

```text
Canvas              #F6F7F4
Canvas Warm         #FAFAF7
Surface             #FFFFFF
Surface Subtle      #F8F9F7
Surface Selected    #F0F6F2

Text Primary        #17211C
Text Secondary      #4F5F56
Text Muted          #768078
Text Inverse        #FFFFFF

Border Subtle       #E8EBE6
Border Default      #DCE2DC
Border Strong       #C7D0C8

Brand Green         #245C46
Brand Green Hover   #1B4A38
Brand Soft          #EAF3ED
Brand Border        #C9DDD0

Signal Lime         #C1FF72   // rare highlight only

Success             #237A57
Success Soft        #E9F6EF
Warning             #956800
Warning Soft        #FFF5D8
Danger              #B54747
Danger Soft         #FDECEC
Info                 #2F6F9F
Info Soft            #EAF2F8
Neutral State        #5F6B63
Neutral Soft         #F0F2EF
```

### 3.2 Color rule

**Deep green is the primary product action color. Lime is no longer the default button fill.**

Lime can appear selectively as:

- brand spark/highlight;
- positive chart marker;
- focus/highlight detail;
- small marketing-adjacent moments.

It should not outline every active object.

### 3.3 Surfaces

Use the hierarchy:

1. off-white canvas;
2. white working surfaces;
3. soft-neutral selected/secondary surfaces;
4. overlays/popovers above them.

Do not build depth with heavy shadows.

Shadows should be reserved for:

- dialogs;
- popovers;
- menus;
- floating preview/document sheets;
- drawers where separation needs it.

### 3.4 Radius

Recommended:

- controls: 8–10px;
- cards/panels: 10–12px;
- document preview: 4–8px;
- status chips: pill where appropriate;
- not every object should be pill-shaped.

### 3.5 Typography

Keep **Hanken Grotesk** unless implementation testing exposes a specific readability issue.

Keep **JetBrains Mono** for:

- invoice numbers;
- receipt numbers;
- payment/provider references;
- technical identifiers.

Use Hanken Grotesk + `font-variant-numeric: tabular-nums` for most money values, dates and metrics.

Recommended hierarchy:

- page title: 28–32px, 600/650;
- major metric: 28–40px depending hierarchy;
- section heading: 16–20px;
- table/body: 14px;
- secondary metadata: 12–13px;
- avoid excessive uppercase metadata labels.

---

## 4. Product Shell

The shell should move from a dark "command center" to a quiet finance workspace.

### Desktop sidebar

Target:

- white or very pale neutral background;
- subtle right border;
- approximately 232–248px expanded width on large screens;
- optional compact mode may remain, but should not dominate the design concept;
- no active-item glow;
- active item uses soft brand surface + deep-green icon/text and/or a small left indicator;
- icons remain Lucide;
- section labels become quieter and less aggressively uppercase;
- settings/help/account controls can anchor near the bottom where appropriate.

Current visible routes should be grouped around real product tasks, not future placeholders.

Suggested current IA:

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

Do not expose unbuilt Collections/Forecast/Recurring routes during this visual overhaul.

### Topbar

Replace the current business-name + user-email + role-chip + visible logout treatment with a lighter utility bar.

Recommended layout:

```text
[mobile/menu]     Search or jump to…                  Help  Notifications  Avatar
```

Optional left-side context can show a breadcrumb or current area if useful.

User role and Logout should live inside the user/account menu rather than consume permanent space.

A future workspace switcher can occupy the business identity area when multi-organisation switching becomes real.

### Page headers

Keep page titles inside page content, not duplicated in the shell.

Standard header pattern:

```text
Title                                   Primary action
Short operational description          Secondary actions in menu
```

### Create Invoice action

The current floating Create Invoice quick action is not appropriate as a universal desktop design pattern.

Prefer:

- primary button in Invoices/Customers/Dashboard contexts where creation is relevant;
- command palette/global shortcut later;
- optional floating CTA only on mobile if it materially improves use.

---

## 5. Shared Component Redesign

### Buttons

Preserve semantic variants, update visuals:

- Primary: deep green fill, white text.
- Secondary: soft green fill / deep-green text.
- Outline: white/light surface with neutral border.
- Ghost: no border, dark neutral text.
- Destructive: restrained red treatment.

No glowing primary controls.

### Forms

Inputs should use:

- white background;
- neutral border;
- 40–44px minimum control height;
- clear labels;
- soft brand focus ring;
- subtle disabled state.

Avoid monospaced date fields unless there is a real reason.

### Filter toolbar

Replace generic card-like filter forms on list pages with a shared `DataToolbar`/equivalent pattern:

```text
[Search................................] [Status ▾] [More filters]   [Export]
```

Where status is central, use tabs/segmented controls above or within the table shell.

Advanced filters can open a popover/drawer.

### Tables

The table is a flagship product primitive.

Target:

- white table surface;
- subtle separators;
- 44–52px rows depending information density;
- calm sticky header;
- selected/hover row = very soft neutral/brand tint;
- money right aligned;
- references monospaced;
- whole-row navigation where accessible;
- `…` action menu for secondary actions;
- avoid permanent View buttons in every row;
- mobile converts to purpose-built record rows/cards, not a squeezed desktop table.

Add shared helpers where useful:

- `DataToolbar`;
- `TableRowActionMenu`;
- `TableEmptyState`;
- column alignment helpers;
- optional selected-row state;
- optional master-detail shell.

### Status badges

Retain the current central status mapping, but update fills/borders for the light system.

Success should not be identical to brand green.

### Cards

Keep `Card`, `SectionCard`, `MetricCard`, but remove glow emphasis.

Do not make every content group a card.

### Drawers / sheets

Introduce one accessible shared drawer/sheet primitive for:

- row detail;
- payment inspection;
- future promise-to-pay;
- secondary forms;
- mobile detail.

### Menus

Introduce an accessible dropdown/action-menu primitive rather than custom route-local action lists.

---

## 6. Dashboard / Overview Redesign

The current dashboard contains strong data but too many equal cards.

### Current data available without backend changes

- net/gross collections;
- refunds;
- successful payments;
- receipts issued;
- outstanding balance;
- overdue balance;
- active pending payments;
- unresolved review count;
- invoice status breakdown;
- aging;
- cashflow trend;
- recent invoices;
- recent payments;
- recent receipts;
- reconciliation/review issues;
- payment setup state.

### Target structure

```text
Overview                                    [Last 30 days ▾] [Create invoice]

Outstanding       Overdue       Net collected       Needs attention
₦...              ₦...          ₦...                ...

┌─────────────────────────────────────────────┬──────────────────────────┐
│ Collections / cashflow                      │ Needs attention          │
│ large primary chart                         │ ranked actionable list   │
└─────────────────────────────────────────────┴──────────────────────────┘

┌──────────────────────────────┬─────────────────────────────────────────┐
│ Aging                        │ Recent meaningful activity              │
│ concise distribution         │ unified invoice/payment/receipt feed   │
└──────────────────────────────┴─────────────────────────────────────────┘
```

### Changes

- Move reporting-period control into header/top toolbar; remove the full reporting-period card.
- Keep 3–4 primary metrics only.
- Fold successful-payment/receipt counts into supporting copy or a compact secondary strip.
- Keep cashflow as the main visualization.
- Retain aging because it is core AR information.
- De-emphasize or remove invoice-status chart if it does not provide a useful action.
- Merge recent invoices/payments/receipts into a more coherent activity feed when practical.
- Keep true review issues highly visible and actionable.
- Payment setup should be a contextual setup/status banner, not another equal dashboard module.

### Mobbin direction

Primary references are in `07_MOBBIN_APP_REFERENCE_LIBRARY.md`, especially Mercury, Stripe, Airwallex, Xero, Midday and HoneyBook dashboards.

---

## 7. Invoices List Redesign

### Current problems

- large standalone filter card;
- permanent View button in every row;
- no visual distinction between primary and secondary information;
- status filtering is a select rather than a fast workflow control.

### Target

```text
Invoices                                           [New invoice]

[All] [Open] [Overdue] [Paid] [Draft]
[Search invoice/customer................] [Filters] [Export]

Invoice        Customer        Due         Balance        Status       •••
INV-1042       Acme Ltd        12d ago     ₦850,000       Overdue      •••
```

Use current supported statuses; do not invent server filters that do not exist.

If a compact status-tab mapping requires combining multiple backend statuses into "Open", implement it only if it is easy and unambiguous. Otherwise expose the real states cleanly.

### Behavior

- whole row navigates to detail;
- secondary actions in overflow;
- mobile record row prioritizes customer, invoice number, balance, due and status;
- preserve pagination and filter state.

A master-detail side pane may be added if it can reuse existing detail data without making the task brittle; it is optional for the first overhaul pass.

---

## 8. Invoice Creation Redesign — Flagship

The current two-column page is a useful starting point, but its right side is only a totals card rather than a true invoice preview.

### Desktop target

```text
← Invoices       New invoice            Saved draft       [Save] [Send]

┌─────────────────────────────────┬───────────────────────────────────────┐
│ EDITOR                          │ CUSTOMER-FACING INVOICE PREVIEW       │
│                                 │                                       │
│ Customer                        │ Merchant / Invoice #                   │
│ Dates / terms                   │ Bill to                               │
│ Reference                       │ Line items                            │
│                                 │ Totals                                │
│ Line items                      │ Notes / payment terms                 │
│                                 │                                       │
│ Discount / tax                  │ Uses actual public-document grammar   │
│ Notes                           │                                       │
└─────────────────────────────────┴───────────────────────────────────────┘
```

Recommended proportion: approximately 44/56 or 48/52 depending final preview width.

### Editor rules

- group related fields into sections without nesting every section in a separate card;
- line items should resemble an editable table/grid, not independent bordered mini-cards;
- Add item should be obvious;
- destructive remove becomes icon/row action rather than large red text button;
- future product/service picker should fit into this line-item pattern;
- customer-facing and internal fields must be explicitly distinguished.

### Preview rules

The preview should render the actual customer-facing information model:

- business identity;
- invoice number/dates;
- customer;
- line items;
- totals;
- notes;
- payment/due terms.

It should visually relate to the public invoice experience.

Preview totals can update optimistically but server-calculated values remain authoritative.

### Tablet/mobile

- editor becomes single column;
- Preview opens as a full-screen sheet/route mode;
- Save/Send actions remain reachable;
- line-item editing must be touch-friendly.

---

## 9. Invoice Detail Redesign — Payment Trail in Product Form

The detail page should become the clearest expression of Lumina's product thesis.

### Header

Show:

- invoice number;
- status;
- customer;
- balance due;
- due date / overdue age;
- one primary action;
- secondary actions in overflow.

Do not permanently expose Edit + Send + Cancel + Void as equal controls.

### Body

Recommended desktop layout:

```text
┌──────────────────────────────────────────────┬──────────────────────────┐
│ Invoice/document + financial summary         │ Activity / payment trail │
│                                              │                          │
│ line items                                   │ Created                  │
│ totals                                       │ Sent                     │
│ public/payment state                         │ Viewed                   │
│                                              │ Paid / reconciled        │
└──────────────────────────────────────────────┴──────────────────────────┘
```

Unify relevant lifecycle events as far as current data allows.

Do not hide reconciliation/payment details that finance users need.

---

## 10. Customers List and Customer Detail

### Customer list

Current data is contact-oriented. Redesign the visual hierarchy now without inventing unavailable AR metrics.

Initial columns can remain:

- customer;
- email/phone;
- status;
- created;
- overflow actions.

Remove permanent View/Edit/Archive button clusters.

As Customer 360 backend capability expands later, evolve columns toward:

- outstanding;
- overdue;
- last payment;
- risk/collection state.

### Customer detail

The current endpoint already provides invoice summary values:

- invoice count;
- invoiced total;
- paid total;
- balance due.

Use these as the beginning of Customer 360.

Target:

```text
Acme Nigeria Ltd                          [Edit] [•••]
email · phone · billing address

Invoiced        Paid           Balance due       Invoices
₦...            ₦...           ₦...              ...

[Overview] [Invoices]

Invoice history / account activity
```

Do not render empty future tabs such as Payments/Statements until their data is real.

Customer identity/contact information can move into a compact right rail or a summary block rather than consume a large 360px card permanently.

---

## 11. Payments and Reconciliation Redesign

This route has strong domain logic and must remain precise.

### Preserve distinctions between

- attempt state;
- provider payment status;
- successful money-received truth;
- reconciliation state;
- review state;
- settlement account;
- refund state.

Do not simplify the UI by collapsing financially distinct states.

### Target hierarchy

```text
Payments
Collected        Awaiting        Failed/abandoned       Needs review

[Reconciliation] [All attempts] [Needs review]
[Search........................] [Status ▾] [Filters]

Reference | Customer | Invoice | Amount | Payment | Reconciliation | Date | •••
```

### Changes

- summary becomes a compact stat strip rather than four oversized cards;
- preserve segmented views;
- collapse filters into compact toolbar;
- make table the dominant surface;
- row selection may open a right-side detail drawer;
- `Needs review` view should elevate exception reason and next action;
- review-event history can become a side rail or context panel rather than a detached card below the table.

---

## 12. Receipts, Exports and Audit

### Receipts

Use the same list grammar as Payments/Invoices.

Columns should prioritize:

- receipt;
- customer;
- invoice;
- amount;
- refund state;
- issued date;
- action menu.

Payment reference can be secondary/expandable on narrower desktop.

### Exports

Exports is one of the few places where cards are appropriate because the user is selecting a task/dataset rather than browsing a record list.

Use calm export panels with:

- dataset name;
- description;
- compact filters;
- export button;
- permission state.

### Audit Logs

Audit is inherently dense.

Use:

- full-width table;
- compact filter toolbar;
- detail drawer for safe metadata;
- no decorative dashboard treatment.

---

## 13. Settings and Team

Create a coherent Settings shell instead of isolated route experiences.

Current real sections:

```text
Settings
  Payment setup
  Team
  Audit log    [owner/admin]
```

Do not add fake settings pages.

### Layout

Desktop:

- secondary settings navigation on the left (inside content, distinct from global sidebar);
- content max-width around 840–1000px depending page;
- flat section cards with clear titles;
- danger zones visually separated but not theatrical.

### Team

- Invite teammate = compact focused panel/drawer;
- member table below;
- role change actions compact;
- invitation status separate from active members.

### Payment Setup

Treat it like a high-trust financial setup flow:

- current account/status summary;
- bank + account fields;
- resolved account confirmation;
- clear verification state;
- clear disabled/reactivation state.

Do not make it visually resemble a generic dashboard page.

---

## 14. Auth and Onboarding

### Login

A simple centered light card is acceptable, but make it feel intentional:

- warm/light canvas;
- generous whitespace;
- crisp logo;
- one clear action;
- optional subtle illustration/product texture only on wide desktop.

### Registration / onboarding

Use a calm step-based experience inspired by modern financial onboarding.

Possible desktop layouts:

- centered focused form with progress; or
- form left + restrained contextual illustration/product preview right.

Preserve Lumina's real three stages:

1. Account;
2. Business profile;
3. Payment Setup.

Do not add steps merely to mimic references.

Payment Setup during onboarding should visually feel like the same flow.

---

## 15. Public Invoice and Receipt Experience

These are customer-facing product surfaces and should receive dedicated art direction.

### Public invoice

Current structure already contains the correct data and payment states, but the dark header should be removed.

Target:

- warm/off-white canvas;
- merchant identity at top;
- amount due prominent;
- due date + invoice status immediately readable;
- clean invoice document body;
- integrated line items and totals;
- payment panel with deep-green primary CTA;
- Paystack redirect/support message understated;
- Lumina shown as secondary infrastructure branding.

Desktop can use a document + payment summary split.

Mobile must show amount due and payment action early without forcing long scroll.

### Public receipt

Use the same customer-document shell as public invoice so the two feel like one system.

Receipt state, payment reference and refund summary must remain explicit.

### Print

Preserve and retest print/PDF behavior after removing dark compatibility CSS.

---

## 16. Charts and Data Visualization

Keep Recharts.

New chart rules:

- neutral gridlines;
- deep green for primary collections/net series;
- lighter/sage secondary series;
- red reserved for refunds/problems, not decoration;
- tooltip on white overlay surface;
- chart titles explain what the chart answers;
- avoid donut/pie charts where a ranked list or horizontal bar is easier to act on;
- no gradients unless they communicate a real range/forecast.

---

## 17. Motion

The authenticated product is not the marketing site.

Use motion for:

- drawers/sheets;
- menu opening;
- row/detail selection;
- preview updates;
- optimistic save confirmation;
- small success transitions;
- loading/skeleton changes.

Recommended duration: roughly 120–220ms for normal interaction.

Avoid:

- scroll-triggered storytelling;
- card entrance cascades;
- glowing pulses;
- parallax;
- decorative chart animation that delays reading.

GSAP should be removed from simple product interactions where CSS transitions can do the job. Keep GSAP dependency only where it already serves another surface or a genuinely useful interaction.

Honor `prefers-reduced-motion`.

---

## 18. Responsive System

### 1440px+

- persistent sidebar;
- split views where useful;
- data tables can show full operational columns;
- invoice editor + live preview side-by-side.

### 1024–1280px

- sidebar may collapse or narrow;
- reduce table columns;
- detail rail may become drawer;
- invoice preview width must remain usable.

### 768px

- drawer navigation;
- tables selectively become compact record lists;
- two-column forms collapse;
- preview becomes toggle/sheet.

### ~390px mobile

- one clear task per viewport;
- 44px touch targets;
- sticky contextual bottom action only when it helps;
- no squeezed desktop grids;
- public invoice/payment is a priority mobile experience.

---

## 19. Migration Architecture

The redesign should be implemented in controlled passes rather than route-by-route ad hoc color edits.

### Pass 1 — Foundation

- replace dark root tokens with light canonical tokens;
- remove `color-scheme: dark`;
- remove/retire the global utility-class remapping layer;
- update typography rules;
- update chart variables;
- restyle shared buttons/cards/forms/status/alerts/tables;
- introduce dropdown menu, drawer/sheet and compact data-toolbar primitives if not already present;
- preserve print overrides.

### Pass 2 — Shell

- sidebar;
- topbar;
- responsive navigation;
- page container/header rhythm;
- account menu;
- remove desktop active glows;
- replace or retire global floating Create Invoice action.

### Pass 3 — Flagship financial workflows

In this order:

1. Dashboard / Overview.
2. Invoices list.
3. Invoice create/edit.
4. Invoice detail.
5. Payments / reconciliation.
6. Customers list/detail.

These establish the reusable visual grammar.

### Pass 4 — Supporting product routes

- Receipts.
- Receipt detail.
- Exports.
- Audit logs.
- Team.
- Payment setup.

### Pass 5 — Customer-facing and entry flows

- Public invoice.
- Public receipt.
- Login/register.
- Business onboarding.
- invite acceptance.

### Pass 6 — Cleanup

- remove dead dark-theme compatibility classes/tokens;
- consolidate domain-local PageHeader/action wrappers into shared primitives where safe;
- search for hardcoded slate/teal/dark legacy utilities and migrate remaining product UI;
- check print styles;
- document final design tokens/components.

---

## 20. Theme Strategy

**Light mode is the canonical product theme.**

Do not block this overhaul on implementing a dark/light toggle.

The CSS/token architecture should not make a future dark theme impossible, but dual-theme support is a separate quality pass unless explicitly requested.

This avoids doubling visual QA during the overhaul.

---

## 21. No-Regression Rules

This task is a design overhaul, not a business-logic rewrite.

Preserve:

- auth/session behavior;
- onboarding gates;
- RBAC;
- organisation isolation;
- invoice calculations/status transitions;
- Paystack setup/payment behavior;
- webhook/reconciliation semantics;
- refund/overpayment logic;
- receipt immutability;
- CSV export safety;
- audit safety;
- public-token boundaries.

If UI restructuring requires extracting components, prove behavior parity with tests.

Do not change backend contracts merely to match a Mobbin screen.

---

## 22. Browser QA Matrix

Codex must review the overhaul in-browser, not rely on static code confidence.

At minimum:

- 1440px desktop;
- 1280px laptop;
- 1024px compact desktop/tablet landscape;
- 768px tablet;
- 390px mobile.

Test states:

- empty;
- loading;
- server error;
- long organisation/customer name;
- long email/reference;
- very large NGN values;
- overdue invoice;
- partially paid invoice;
- overpaid/review-required payment;
- disabled/verification-delayed payment setup;
- viewer permissions;
- owner/admin permissions;
- public invoice payable;
- public invoice paid;
- payment confirmation pending/failed/successful;
- receipt with refund state;
- print invoice/receipt.

Take before/after screenshots for flagship routes and compare hierarchy to the referenced Mobbin screens.

---

## 23. Definition of Done

The overhaul is complete when:

- `apps/web` is genuinely light by default, not dark CSS with isolated light patches;
- the old global dark utility remapping is removed or reduced to no longer control normal layout appearance;
- shell/navigation feels intentional in light mode;
- Dashboard, Invoices, Payments and Customers share one consistent financial-workspace grammar;
- invoice authoring has a true customer-facing preview or a clearly staged path to it if T020 backend additions are being implemented immediately after;
- public invoice/receipt feel premium and customer-safe;
- mobile layouts are purpose-built rather than desktop shrinkage;
- status and financial truth remain explicit;
- design primitives are reusable;
- no important financial behavior regresses;
- accessibility/keyboard/focus states remain correct;
- typecheck/lint/tests/build pass;
- browser QA is complete.

The target is not visual similarity to one competitor. The target is for Lumina to feel like a coherent, current financial product that can plausibly serve both an SME owner and a dedicated receivables team.
