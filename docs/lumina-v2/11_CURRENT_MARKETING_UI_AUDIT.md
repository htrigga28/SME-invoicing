# Lumina Marketing Evolution — Current UI Audit

**Status:** IMPLEMENTATION CONTEXT  
**Audit branch:** `dev` after merge of PR #22  
**Audit date:** 2026-09-18  
**Scope:** `apps/marketing`

Companion docs:
- `05_MARKETING_SITE_REDESIGN.md`
- `10_MARKETING_REFERENCE_LIBRARY.md`
- `12_MARKETING_REDESIGN_CODEX_PROMPT.md`

This audit exists so Codex does not waste time rediscovering the current marketing implementation or accidentally preserve obsolete visual decisions.

---

# 1. Executive finding

The current marketing application is structurally usable but visually belongs to the **old dark Payment Trail direction**.

The code has already been partially documented as light marketing in `DESIGN.md` and `05_MARKETING_SITE_REDESIGN.md`, but the live implementation has not actually migrated.

The current marketing CSS still starts with:

- `color-scheme: dark`;
- near-black canvas and surfaces;
- neon-lime primary accent;
- dark translucent header;
- glowing route/orbit language;
- dark product canvases;
- strong black shadows.

The homepage source comment also still defines the site as:

- "Night graphite fields";
- "signal lime";
- a route-line visual system.

Therefore this task is not a polish pass.

> It is a real implementation migration from the old dark marketing system to the new light editorial-receivables system.

---

# 2. Current route structure

## Homepage

`apps/marketing/src/app/page.tsx`

Current order:

1. `Hero`
2. `ConnectedPaymentTrail`
3. `OutcomeExplorer`
4. `OperationsField`
5. `TrustArchitecture`
6. `FaqSection`
7. `SignupSection`

This is a useful component boundary, but the order and visual treatment need to change.

Current issue:
- the page moves from one abstract product concept to another;
- it does not take enough advantage of the now-merged T020 invoice experience;
- the hero shows many small payment-trail panels simultaneously instead of making one invoice the central visual object;
- the current story is more "payment infrastructure diagram" than "inviting receivables software."

Recommended future order is defined in `05_MARKETING_SITE_REDESIGN.md`.

---

# 3. Root styling

## `apps/marketing/src/app/globals.css`

Current state:
- approximately 40k+ of monolithic marketing CSS;
- `:root { color-scheme: dark; }`;
- `--background: #070a08`;
- `--surface: #0d110e`;
- `--accent: #c1ff72`;
- dark text/surface token assumptions throughout;
- dark box shadows;
- lime route lines;
- dark modal/nav/product surfaces;
- large amounts of component CSS already tied to old class names.

Examples of obsolete implementation language:
- `.hero-orbits`;
- `.trail-route`;
- dark `.trail-canvas`;
- dark `.product-menu-preview`;
- dark `.trust-hub`;
- `.signup-section` uses the lime accent as a full section background;
- `.marketing-footer` uses `--background-deep`.

### Required action

Do not append a second theme below the old CSS.

Replace the foundation.

Use the new marketing tokens from `05_MARKETING_SITE_REDESIGN.md`.

Delete obsolete dark rules as their components are replaced.

The finished CSS must not contain a dormant full old theme that future work can accidentally revive.

### Architectural constraint

Do NOT turn this task into a Tailwind rewrite.

The marketing app already uses semantic CSS class names effectively.

Keep that model unless a local component benefits from utility classes.

Primary goal:
- replace the visual system;
- clean dead CSS;
- retain maintainable section naming.

---

# 4. Motion infrastructure

## Existing dependency

`apps/marketing/package.json` already includes:
- `gsap ^3.13.0`

Current implementation dynamically imports base GSAP in:
- hero trail visual;
- product menu;
- outcome explorer.

No current `ScrollTrigger` usage was found.
No Motion / Framer Motion dependency was found.

### Required action

Do NOT add Motion/Framer Motion for this redesign.

Use:
- CSS transitions for hover/micro interaction;
- GSAP for authored entrance sequences where CSS is insufficient;
- GSAP `ScrollTrigger` for the signature invoice-to-cash sequence and only other genuinely scroll-linked motion.

This keeps the dependency surface smaller and makes the existing GSAP investment useful.

### Anti-pattern to remove

`ConnectedPaymentTrail` currently attaches manual `scroll` and `resize` listeners and calculates progress from `getBoundingClientRect()`.

Replace this behavior with ScrollTrigger when rebuilding that section.

Do not create React state updates on each scroll frame.

---

# 5. Header

## `apps/marketing/src/components/layout/marketing-header.tsx`

Current strengths:
- desktop navigation exists;
- product dropdown exists;
- mobile navigation exists;
- Escape/outside interaction exists;
- reduced-motion helper exists;
- sign-in and create-account actions are wired;
- navigation copy is centralized.

Current visual problems:
- dark floating translucent header;
- dark dropdown preview;
- existing product categories are "Payment trail / Outcomes / Operations", which are old marketing abstractions rather than the clearest current product categories;
- dropdown animation is more complex than the information requires.

### Preserve

- behavior and accessibility structure;
- mobile menu behavior;
- sign-in and signup URLs;
- existing focus/escape handling.

### Change

Target navigation:

```text
Lumina

Product
  Invoicing
  Payments & reconciliation
  Receipts & control

How it works
Trust
FAQ

Sign in
Create account
```

Do not add:
- Pricing;
- Solutions pages;
- Resources;
- customer stories;
unless real routes/content exist.

Visual:
- light;
- restrained;
- no dark pill floating over the page;
- white/translucent warm header;
- subtle bottom border after scroll;
- product dropdown can remain a modest white panel;
- no large animated dark preview panel is required.

---

# 6. Hero

## `apps/marketing/src/components/hero/hero.tsx`

Current strengths:
- correct semantic heading;
- primary and secondary CTA;
- content is centralized;
- product proof appears immediately after copy.

Current problems:
- centered generic SaaS hero;
- old neon/dark visual world;
- decorative orbits;
- headline still describes "spreadsheet chase" rather than the stronger v2 product position;
- the visual below is an abstract multi-panel diagram.

### Replace hero content with

Eyebrow:
`RECEIVABLES FOR GROWING BUSINESSES`

Headline:
`Turn every invoice into predictable cash.`

Support:
`Create professional invoices, collect payments, reconcile what arrived, and know exactly what needs attention.`

Primary CTA:
`Create account`

Secondary CTA:
`See how it works`

Trust/support note:
`Built for NGN invoicing and Paystack payment flows.`

### Layout direction

Desktop:
- copy on left or upper-left, not necessarily centered;
- large product composition entering the viewport on right/below;
- invoice document is the visual hero;
- dashboard/payment state can sit behind it as secondary layers.

Mobile:
- copy first;
- CTAs;
- one readable invoice/product composition;
- no tiny overlapping windows.

### Delete

- hero orbit rings;
- old dark product-trail mosaic from the hero;
- window-control dots as a primary visual trope.

---

# 7. Hero visual

## `apps/marketing/src/components/hero/payment-trail-visual.tsx`

Current state:
- six different payment/invoice cards shown at the same time;
- current animation simply reveals all panels and route lines;
- concept is technically correct but visually reads like an infrastructure topology.

### Required replacement

Replace with a new component, working name:

`InvoiceHeroScene`

It should visually derive from the merged app's:
- invoice document;
- invoice editor;
- dashboard;
- public invoice;
- payment/reconciliation treatment.

Primary visual:
- one invoice document;
- one small contextual dashboard/payment layer;
- one small state indicator.

No more than 3 visual layers in the hero at once.

The hero should communicate:
1. this is invoicing software;
2. it accepts/understands payments;
3. it is professional financial software.

Do not attempt to explain the entire lifecycle in the hero.
The signature scroll sequence handles that.

---

# 8. Signature Payment Trail

## `apps/marketing/src/components/sections/connected-payment-trail.tsx`

Current state:
- five static text nodes in a horizontal rail;
- manually calculated scroll progress;
- settlement branch;
- explanation is infrastructure-heavy.

This section should be rebuilt almost completely.

### New role

It becomes the signature homepage experience:

> one invoice visibly moves from creation to financial truth.

New step names:

1. **Create**
2. **Share**
3. **Pay**
4. **Verify**
5. **Match**
6. **Know**

Do not use "Collect" here until automated collection/reminder functionality ships.

### Canonical demo

Use one consistent synthetic business story.

Business:
`Adebayo Studio`

Customer:
`Northstar Projects`

Invoice:
`INV-000184`

Amount:
`₦78,400`

Provider reference:
`T8129-4F3A-90LX`

Receipt:
`RCT-000241`

Use these same values through every step.

### Desktop choreography

Target:
- one pinned product stage;
- approximately 360–440vh section length;
- narrative rail on left;
- product object on right;
- only one primary state active at a time;
- previous states may remain faintly as paper layers if useful.

State progression:

#### CREATE
Show:
- light invoice editor;
- customer;
- two line items;
- total;
- live invoice preview.

#### SHARE
Editor chrome recedes.
Invoice document becomes dominant.
Public/share state appears.

#### PAY
Customer-facing invoice/payment surface takes over.
`Pay ₦78,400 online` is visible.

#### VERIFY
Payment confirmation enters.
Provider reference appears.
Do not show server jargon as the headline.

#### MATCH
Reference visually resolves to `INV-000184`.
Status changes to matched.
Balance becomes `₦0 due`.

#### KNOW
Invoice/receipt compress into operational view.
Show:
- paid;
- receipt issued;
- dashboard position updated;
- needs-review count unaffected/clear.

### Motion rules

Use ScrollTrigger:
- pin only the visual stage, not the whole page shell;
- use scrubbed transforms/opacity;
- avoid changing React state on every frame;
- no layout-thrashing animation;
- animate transform/opacity/clip-path primarily;
- do not spin, bounce, or use elastic easing;
- no glow effects.

### Mobile

Do not pin.

Render six vertical states in logical order:
- copy;
- product state;
- next state.

Use short in-view reveals.

All six states must remain understandable with JavaScript disabled/reduced motion where practical.

---

# 9. Invoicing chapter

This does not currently exist as a distinct chapter.

Create a new section/component.

Working component:
`InvoicingChapter`

ID:
`invoicing`

Purpose:
show the strongest shipped T020 capability immediately after the signature lifecycle.

Primary app reference:
- merged `invoice-form-page.tsx`;
- merged `invoice-document.tsx`.

Content direction:

Eyebrow:
`PROFESSIONAL INVOICING`

Headline:
`Compose the invoice once. Let the customer see exactly what you meant.`

Body:
`Build from reusable products and services or add an item on the fly. Set payment terms, add a customer reference, and preview the customer-facing invoice before it leaves your workspace.`

Visual:
- editor controls on one side;
- full customer preview on the other;
- catalogue picker appears as a small secondary interaction;
- line item updates should reflect in the invoice preview.

Truthful features available now:
- products/services catalogue;
- ad-hoc line items;
- payment terms presets;
- customer reference / PO;
- memo;
- tax/discount fields;
- live preview;
- draft/send actions.

Do not mention:
- recurring;
- automated reminders;
- quotes;
- customer portal;
- multi-currency.

---

# 10. Outcome explorer

## `outcome-explorer.tsx`

Current logic is useful.

Preserve:
- accessible tabs;
- keyboard navigation;
- three scenarios;
- dynamic panel;
- synthetic-data labels.

Change visual structure and copy emphasis.

Target scenarios:
1. Matched
2. Needs review
3. Refund confirmed

This is one of the few interactive non-scroll sections.

### Visual target

Left:
- scenario navigation;
- plain language.

Right:
- one clean financial record;
- amount;
- invoice;
- provider reference;
- current resolution state;
- next action.

Do not make it look like another giant rounded dashboard card.
Use more open editorial composition.

Remove excessive blur animation.

Transition:
- 160–220ms opacity + 10–16px x movement;
- no blur needed.

---

# 11. Operations / receivables visibility

## `OperationsField`

Current strengths:
- uses realistic implemented metrics;
- has actual financial concepts:
  - net collected;
  - outstanding;
  - overdue;
  - needs review;
  - latest matched payment.

Current problems:
- grid is overly diagrammatic;
- four generic "Collect / Understand / Resolve / Control" chapters feel like feature cards;
- styling is dark and dense.

### Required replacement

Build a section centered on:

> **Know what needs attention before it becomes a surprise.**

Use one large dashboard/receivables composition.

Show:
- Outstanding;
- Overdue;
- Net collected;
- Needs attention;
- recent matched payment;
- aging or cashflow chart if helpful.

Use the merged Lumina dashboard as the product reference.

Around the main composition, add only 2–3 concise callouts:
- current position;
- real exceptions;
- payment history stays intact.

Do not create a 4-card equal feature grid.

---

# 12. Customer payment chapter

Create a dedicated chapter using the merged public invoice design.

Working component:
`CustomerPaymentChapter`

Purpose:
show that Lumina is useful to the payer, not only to the business.

Content:

Eyebrow:
`A BETTER WAY TO GET PAID`

Headline:
`Give the customer one clear invoice and one clear next step.`

Body:
`Customers can open a public invoice without a Lumina account and pay online when your business payment setup is active.`

Visual:
- public invoice;
- amount due;
- due date;
- pay button;
- merchant identity;
- payment confirmation state.

Do not show a customer portal yet.
Do not show saved payment methods.
Do not show bulk invoice payment.

---

# 13. Trust / control

## `TrustArchitecture`

Current version is technically accurate but looks like a verification architecture diagram.

### Preserve the actual claims

- Lumina does not hold wallet balances;
- businesses do not paste Paystack secret keys;
- amounts/payout route are server-derived;
- provider-confirmed status;
- masked payout details;
- tenant isolation / RBAC.

### Change the presentation

Headline:
`Financial clarity without becoming your bank.`

Support:
`Lumina keeps invoice and payment operations connected while Paystack handles the payment flow and your team keeps role-scoped control.`

Layout:
- one strong text-led statement;
- 3–4 structured control rows;
- one small product/audit/payment setup visual.

Do not:
- use a central circular "verification hub";
- draw network topology lines;
- make unsupported security/compliance certification claims.

---

# 14. FAQ

Current FAQ content is mostly usable.

Preserve truthful answers.

Restyle:
- light;
- clean separators;
- no card grid;
- concise open/close interaction.

Keep the FAQ after trust/control.

---

# 15. Signup / closing CTA

## `SignupSection`

Current state:
- full neon lime section;
- onboarding path diagram.

New direction:
- this is the **one strong full-field brand moment** near the end;
- use deep Lumina green, not lime;
- white/cream text;
- small lime accent only if useful.

Headline:
`Turn outstanding invoices into a workflow you can control.`

Support:
`Create your Lumina workspace and send your first professional invoice.`

Primary:
`Create account`

Secondary:
`Sign in`

The three setup steps can remain only if the composition stays simple.

Do not make the closing section feel like onboarding documentation.

---

# 16. Footer

Current footer is dark.

New footer:
- warm off-white or white;
- thin border above;
- deep-green links;
- compact;
- same legal routes;
- same sign-in/product anchors;
- no duplicate giant CTA if the closing CTA already does the job.

---

# 17. Legal pages

`privacy` and `terms` use the same old dark global tokens.

They must migrate to the light system in the same PR.

Do not redesign their information architecture aggressively.

Required:
- warm light canvas;
- readable max line length;
- deep-green links;
- clear headings;
- no obsolete orbit/trail decoration.

---

# 18. Site copy

## `apps/marketing/src/content/site-copy.ts`

Current copy is tightly coupled to old abstractions:
- payment trail;
- outcomes;
- operations;
- infrastructure language.

Update types and data structures to match the new page.

Do not preserve obsolete copy simply because tests currently assert it.

New marketing structure should center:
- invoicing;
- payment;
- reconciliation;
- customer experience;
- financial visibility;
- trust.

### Product-truth rule

Shipped now and safe to market:
- professional invoices;
- reusable catalogue;
- public invoices;
- Paystack online payment;
- partial/full payment handling;
- provider confirmation;
- reconciliation;
- payment review;
- overpayment/refund workflow;
- immutable receipts;
- dashboard;
- exports;
- audit log;
- team/RBAC;
- payment setup.

Not yet safe to market as shipped:
- automatic reminders;
- recurring billing;
- collections workspace;
- promise to pay;
- Customer 360;
- customer portal;
- disputes;
- cash forecasting;
- AI;
- NRS e-invoicing;
- multi-currency;
- accounting/ERP integrations.

If future capability is mentioned at all, explicitly label it as planned. Prefer omission in this redesign.

---

# 19. Current components that can be reused vs replaced

## Reuse behavior, redesign visuals

- `MarketingHeader`
- `MarketingFooter`
- `OutcomeExplorer`
- `FaqSection`
- `SignupAnchor`
- URL helpers
- SEO helpers
- brand logo
- Naira rendering helper
- legal page structure

## Replace substantially

- `PaymentTrailVisual`
- `ConnectedPaymentTrail`
- `OperationsField`
- `TrustArchitecture`
- old hero orbit treatment
- most homepage CSS tied to dark visual system

## Create

Suggested new components:
- `InvoiceHeroScene`
- `InvoiceToCashStory`
- `InvoicingChapter`
- `ReceivablesVisibility`
- `CustomerPaymentChapter`
- `TrustControls`
- small reusable reveal utility if needed

Names can change slightly if the codebase is clearer, but responsibilities should remain.

---

# 20. Testing and cleanup implications

Existing component tests may assert:
- old copy;
- old class names;
- old navigation items.

Update tests to verify:
- semantics;
- labels;
- links;
- keyboard behavior;
- reduced-motion fallback;
- product-stage accessibility;
- correct CTA URLs.

Do not write brittle tests around exact GSAP transforms.

At the end, search for obsolete markers:
- `color-scheme: dark`;
- `#070a08`;
- `hero-orbits`;
- old `trail-route` structures;
- dark-only `product-menu-preview`;
- old `trust-hub`;
- old full-lime signup styling;
- "Night graphite";
- "signal lime" as the environment;
- old "Payment trail / Outcomes / Operations" product navigation labels.

Some words like "payment trail" may remain in explanatory copy, but not as the entire site architecture.

---

# 21. Definition of successful migration

The marketing redesign is successful when a visitor can answer within the first 15–20 seconds:

1. What is Lumina?
   - invoicing and receivables/payment clarity software.

2. Who is it for?
   - growing Nigerian businesses and finance operators.

3. What can I do today?
   - create invoices, get paid online, reconcile payments, issue receipts, and see what needs attention.

4. Why is it different?
   - the invoice and payment trail remain connected into one understandable operational record.

5. What should I do next?
   - create an account or sign in.

The website should look related to the merged light application, while being substantially more editorial, expressive, and animated.
