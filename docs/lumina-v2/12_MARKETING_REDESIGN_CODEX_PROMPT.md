# Lumina v2 — Codex Prompt: Marketing Site Evolution

Use this prompt to execute the Lumina marketing redesign.

---

You are implementing a **full marketing-site evolution for Lumina** in:

`htrigga28/SME-invoicing`

PR #22 has already been merged.

The authenticated Lumina app now uses the new light **Clear Financial Workspace**.

Your job is to redesign `apps/marketing` so the public brand feels related to that app while becoming more editorial, expressive, product-led, and scroll-driven.

This is an implementation task.

**Do not begin another planning phase.**

Do not ask for a moodboard.

Do not invent a new concept.

Do not change the core product strategy.

The design direction and references are already locked.

---

# 0. Git / PR instructions

Start from the latest `dev`.

1. Pull/fetch the latest `dev`.
2. Confirm PR #22 is present in history.
3. Create a branch:
   `feat/marketing-editorial-receivables`
4. Implement this entire redesign on that branch.
5. Do not modify backend/domain behavior unless a marketing build bug absolutely requires a tiny integration fix.
6. Open one PR back into `dev`.
7. Do not split this redesign into multiple PRs unless a hard technical blocker exists.

Suggested PR title:

`feat(marketing): evolve Lumina into editorial receivables experience`

---

# 1. Mandatory reading

Read these files completely before editing:

1. `docs/lumina-v2/05_MARKETING_SITE_REDESIGN.md`
2. `docs/lumina-v2/10_MARKETING_REFERENCE_LIBRARY.md`
3. `docs/lumina-v2/11_CURRENT_MARKETING_UI_AUDIT.md`
4. `docs/lumina-v2/13_MARKETING_VISUAL_QA_SCORECARD.md`
5. `apps/marketing/DESIGN.md`
6. `docs/lumina-v2/06_APP_DESIGN_OVERHAUL.md`
7. `docs/lumina-v2/07_MOBBIN_APP_REFERENCE_LIBRARY.md`
8. `docs/status-rules.md`
9. `docs/rbac-matrix.md` only as needed to avoid false product claims

Then inspect the current code:

- `apps/marketing/src/app/page.tsx`
- `apps/marketing/src/app/globals.css`
- `apps/marketing/src/app/layout.tsx`
- `apps/marketing/src/components/layout/marketing-header.tsx`
- `apps/marketing/src/components/layout/marketing-footer.tsx`
- `apps/marketing/src/components/hero/*`
- `apps/marketing/src/components/sections/*`
- `apps/marketing/src/content/site-copy.ts`
- `apps/marketing/src/lib/seo.ts`
- `apps/marketing/src/lib/urls.ts`
- marketing tests

Also inspect these merged app surfaces because the website must show the real current product:

- `apps/web/src/app/globals.css`
- `apps/web/src/features/invoices/invoice-form-page.tsx`
- `apps/web/src/features/invoices/invoice-document.tsx`
- `apps/web/src/features/invoices/invoice-detail-page.tsx`
- `apps/web/src/features/invoices/invoice-list-page.tsx`
- `apps/web/src/features/dashboard/dashboard-shell.tsx`
- `apps/web/src/features/payments/payments-page.tsx`
- `apps/web/src/features/public-invoices/public-invoice-page.tsx`

Do NOT import route-level components from `apps/web` into marketing.

Use them as visual/product truth references.

---

# 2. Mandatory external-reference study

You have browser access and Mobbin MCP.

Before coding flagship sections, inspect the references below.

Do not spend hours browsing unrelated sites.

Do not widen the research set unless a specific problem remains unresolved.

## 2.1 Dominant reference: Acctual

Before the other references, inspect Acctual carefully:

https://www.lapa.ninja/post/acctual-2/
https://www.lapa.ninja/video/post/acctual-2/
https://www.acctual.com/

The user explicitly likes **the entire motion/composition language of this site**.

Treat Acctual as the dominant reference for:

- elements entering from left/right/corners/bottom;
- elements leaving the viewport again as the user continues to scroll;
- overlapping outgoing/incoming scenes;
- section-to-section handoff;
- typography scale/placement;
- paper/card/UI collage;
- objects partially clipped by viewport edges;
- low-radius paper-like surfaces;
- subtle object rotation;
- realistic shadow;
- occasional strong blue/green chapter fields;
- large readable product visuals.

The required behavior is:

```text
ENTER from off-canvas
→ COMPOSE around a stable headline
→ HOLD long enough to read
→ EXIT physically toward an edge
→ reveal/overlap the NEXT section
```

Do NOT reduce this to generic fade-up animation.

Do NOT copy Acctual's colors, web3/crypto content, illustrations, or exact assets.

Translate the motion/composition system into:
- Lumina invoice documents;
- invoice editor fragments;
- payment confirmation;
- reconciliation/match cards;
- receipts;
- dashboard/receivables panels;
- status labels.

Read the full video-derived specification in:
`docs/lumina-v2/10_MARKETING_REFERENCE_LIBRARY.md`

## 2.2 Other mandatory Lapa references

Inspect:

### Tola
https://www.lapa.ninja/post/usetola/

Use for:
- business-finance warmth;
- whitespace;
- accessible financial tone.

### Acctual
https://www.lapa.ninja/post/acctual-2/
https://www.lapa.ninja/video/post/acctual-2/

Use for:
- invoice/document-led creative finance presentation;
- editorial composition;
- section personality.

### Column
https://www.lapa.ninja/video/post/column-2/

Use for:
- light finance confidence;
- large typographic pauses;
- premium section pacing.

### Stripe 2026
https://www.lapa.ninja/video/post/stripe-1/

Use for:
- homepage macro rhythm;
- product proof;
- transition from promise to product.

### Lasso
https://www.lapa.ninja/video/post/lasso/

Use for:
- one product object moving through multiple states;
- scroll choreography.

### Kikin
https://www.lapa.ninja/post/kikin/

Use only for:
- confidence in a strong green brand field;
- memorable finance presentation.

Do not borrow financing messaging.

## 2.3 Mandatory Pinterest references

Inspect:

### PayFlexi scroll interaction
https://in.pinterest.com/pin/payflexi-saas-landing-page-scroll-interaction--367465650864696367/

Use for:
- scroll-linked SaaS product storytelling.

### Fincore
https://se.pinterest.com/pin/402579654211099912/

Use for:
- finance-specific animation mood.

### Finance SaaS interactive
https://in.pinterest.com/pin/finance-saas-landing-page-madhu-mia--658862620517637819/

Use for:
- light financial UI composition.

### Invoice Maker
https://in.pinterest.com/pin/366691594664008580/

Use for:
- document-led product framing.

Pinterest is moodboard/composition only.
It is not product truth.

## 2.4 Mandatory Mobbin references

Use Mobbin MCP, not only browser previews.

Inspect:

Stripe invoice creation:
https://mobbin.com/flows/03c71446-31eb-497b-b715-3419cf8cd922

Mercury invoice creation:
https://mobbin.com/flows/ef4623ce-bc68-4006-9c98-f720a4546769

Airwallex invoice creation:
https://mobbin.com/flows/45967791-df7e-43f8-954a-4c45b5e30e20

Midday invoice index:
https://mobbin.com/screens/f2a4a414-3111-4357-a01c-0cb2933ecb92

Xero receivables:
https://mobbin.com/screens/7e99b13f-3003-4846-98b4-0e9f939f4969

Stripe finance dashboard:
https://mobbin.com/screens/54ef3db8-2b9e-4ef3-a91a-cad15de1e1c9

Purpose:
- make marketing product UI look like high-quality real financial software;
- maintain relationship with Lumina's actual app.

Do not clone them.

## 2.5 Research checkpoint

Before coding, write a SHORT private implementation note with:

- 6–10 concrete motion/composition observations from Acctual;
- 3 things to take from Tola;
- 3 things to take from Stripe/Lasso motion;
- 3 things to take from merged Lumina app;
- 3 things to explicitly reject.

Do not create a new planning document for this note.

Then start coding.

---

# 3. Locked design identity

Working marketing identity:

> **Editorial Receivables**

Do not reinterpret this.

The site must be:

- light;
- warm;
- inviting;
- product-first;
- invoice/document-led;
- visually authored;
- scroll-responsive;
- financially credible.

It must NOT become:

- a dark/black fintech site;
- crypto-adjacent;
- 3D;
- glassmorphic;
- gradient-led;
- abstract;
- illustration-first;
- generic "bento SaaS";
- a clone of Stripe;
- a clone of Acctual.

---

# 4. Locked tokens

Replace the marketing dark theme.

Use approximately:

```css
--canvas: #F6F7F4;
--canvas-warm: #FAFAF7;
--paper: #FFFFFF;
--surface-soft: #F0F2EF;
--sage: #EAF3ED;
--blue-soft: #EAF2F8;

--ink: #17211C;
--ink-secondary: #4F5F56;
--ink-muted: #768078;

--brand: #245C46;
--brand-hover: #1B4A38;
--signal-lime: #C1FF72;

--success: #237A57;
--warning: #956800;
--danger: #B54747;
--info: #2F6F9F;

--border-subtle: #E8EBE6;
--border-default: #DCE2DC;
```

You may tune values slightly for contrast.

Rules:

- deep green is the primary CTA;
- lime is a small signal only;
- no full neon-lime section;
- no full black section;
- no glow;
- no crypto gradient.

---

# 5. Typography

Keep existing fonts.

Do not install another font.

Use:

- Hanken Grotesk for display/body;
- JetBrains Mono only for IDs/references/data labels.

Hero:
- large;
- dark;
- editorial;
- left-biased or asymmetrical.

Do not make every section heading centered.

---

# 6. Remove old implementation assumptions

The current code still contains obsolete dark-era assumptions.

Remove or replace:

- `color-scheme: dark`;
- `#070a08` dark canvas;
- old near-black surface token system;
- hero orbit rings;
- dark payment-trail hero mosaic;
- dark translucent floating header;
- dark dropdown preview panel;
- glowing/bright trail lines;
- central circular trust hub;
- full-lime signup section;
- dark footer;
- page source comment describing "Night graphite fields";
- old Product nav abstraction:
  - Payment trail
  - Outcomes
  - Operations

Do not hide old CSS underneath new overrides.

Delete dead rules once their components are replaced.

---

# 7. Do NOT rewrite the whole marketing frontend stack

Keep:

- Next.js;
- current app structure;
- current SEO helpers;
- current URL helpers;
- existing form/signup behavior;
- existing legal routes;
- existing GSAP dependency;
- semantic CSS class approach.

Do not:

- migrate marketing to another styling system;
- introduce CSS-in-JS;
- add Framer Motion/Motion;
- add Three.js;
- add WebGL;
- add a second animation library.

Use existing GSAP.

Use GSAP ScrollTrigger where scroll-timeline control is actually needed.

Use CSS for normal hover/entrance transitions.

---

# 8. Page architecture

Implement this exact homepage order:

```tsx
<Hero />
<AudienceBridge />
<InvoiceToCashStory />
<InvoicingChapter />
<OutcomeExplorer />
<ReceivablesVisibility />
<CustomerPaymentChapter />
<TrustControls />
<FaqSection />
<ClosingCta />
```

Header/footer remain in root layout.

Component names may vary minimally if naming is clearer.

Do not add additional homepage chapters without a real need.

---

# 9. Header implementation

Refactor existing `MarketingHeader`.

Preserve:
- fixed/sticky behavior;
- keyboard accessibility;
- Escape;
- outside close;
- mobile nav;
- sign-in URL;
- create-account URL.

New nav:

```text
Product ▼
  Invoicing                 -> #invoicing
  Payments & reconciliation -> #reconciliation
  Receipts & control        -> #trust

How it works                -> #how-it-works
Trust                       -> #trust
FAQ                         -> #faq

Sign in
Create account
```

Visual:
- light;
- no dark floating shell;
- on first load mostly transparent/warm;
- after scroll use white/warm background + subtle border;
- modest shadow only if required;
- Product dropdown white;
- remove large dark preview half.

Mobile:
- simple;
- no hover assumptions;
- accordion is fine.

Do not add Pricing or Resources.

---

# 10. Hero implementation

Use exactly:

Eyebrow:
`RECEIVABLES FOR GROWING BUSINESSES`

H1:
`Turn every invoice into predictable cash.`

Supporting copy:
`Create professional invoices, collect payments, reconcile what arrived, and know exactly what needs attention.`

Primary CTA:
`Create account`

Secondary CTA:
`See how it works`

Trust note:
`Built for NGN invoicing and Paystack payment flows.`

Secondary CTA should scroll to:
`#how-it-works`

## Hero product scene

Replace `PaymentTrailVisual`.

Create:
`InvoiceHeroScene`

The dominant object is an invoice.

Use merged Lumina visual language.

Suggested layers:
1. invoice document foreground;
2. editor/dashboard surface behind left;
3. matched payment/status surface behind right.

Maximum three main layers.

Use realistic demo data.

Do not render the entire app.

Do not make tiny unreadable dashboards.

## Hero motion

On mount:
- eyebrow opacity/translate;
- headline slight masked/translate reveal;
- support/CTAs;
- invoice scene settles in;
- secondary layers arrive 80–140ms after invoice.

Total entrance should feel complete in under ~1.2s.

No looping float.

No orbit.

No glow.

---

# 11. Audience bridge implementation

Create:
`AudienceBridge`

Copy:

```text
For the people who turn finished work into cash.

Growing businesses
Agencies & professional services
Finance & receivables teams
```

Keep visually quiet.

This is not a logo wall.

No fake social proof.

---

# 12. Signature Invoice → Cash implementation

Replace the old `ConnectedPaymentTrail`.

New component:
`InvoiceToCashStory`

ID:
`how-it-works`

Use one canonical demo:

```text
Business: Adebayo Studio
Customer: Northstar Projects
Invoice: INV-000184
Amount: ₦78,400
Provider reference: T8129-4F3A-90LX
Receipt: RCT-000241
Final balance: ₦0
```

Steps:

```text
01 CREATE
02 SHARE
03 PAY
04 VERIFY
05 MATCH
06 KNOW
```

## Desktop composition

At >= 1024px:

- section height approximately 360–440vh;
- two-column viewport composition;
- left = narrative steps;
- right = sticky/pinned product stage;
- visual stage occupies roughly 55–62% width;
- pin ends cleanly before next section.

Recommended structure:

```tsx
<section id="how-it-works">
  <div className="story-shell">
    <div className="story-copy-rail">
      <StoryStep ... />
      ...
    </div>
    <div className="story-stage">
      <InvoiceCreateState />
      <PublicInvoiceState />
      <PaymentState />
      <VerificationState />
      <MatchedState />
      <DashboardResolvedState />
    </div>
  </div>
</section>
```

You may use a single stage component with layered states rather than six independent DOM trees.

Keep accessibility DOM order sensible.

## ScrollTrigger

Import/register ScrollTrigger client-side.

Requirements:
- use `gsap.context`;
- clean up/revert on unmount;
- no manual `window.scroll` math;
- avoid setting React state each frame;
- use one timeline for stage progression;
- use ScrollTrigger progress/labels;
- refresh after layout if required.

Animation:
- transforms;
- opacity;
- clip-path if useful;
- scale only subtle.

Do not animate:
- complex box-shadow every frame;
- filter blur every frame;
- width/height where transform can replace it.

## Stage visuals

### CREATE

Show actual T020 ideas:
- customer selector;
- line items;
- catalogue item;
- total;
- live preview.

Text:
`Build the invoice with the details your customer actually needs.`

### SHARE

Editor recedes.
Invoice paper becomes dominant.

Add:
- public link/shared state.

Text:
`Send one clear document instead of another email attachment chain.`

### PAY

Show:
- public invoice;
- amount due;
- `Pay ₦78,400 online`.

Text:
`Your customer sees what is due and has one clear next step.`

### VERIFY

Show:
- payment confirmed;
- provider reference.

Text:
`Lumina waits for provider-confirmed payment truth.`

Do NOT lead with webhook implementation details.

### MATCH

Show:
- reference visually resolves to invoice;
- matched status;
- balance becomes `₦0 due`.

Text:
`The payment resolves against the invoice instead of becoming another mystery transfer.`

### KNOW

Show:
- receipt issued;
- paid invoice;
- overview metrics updated;
- latest matched activity.

Text:
`The invoice, payment, receipt, and business position stay connected.`

## Mobile

At < 768px:

- disable pin;
- render each step sequentially;
- copy then readable product card/state;
- use short in-view animation;
- no horizontal scroll choreography;
- no scaling full desktop UI to 320px.

At 768–1023px:
- evaluate browser result;
- use reduced pinning only if stable;
- otherwise use sequential layout.

## Reduced motion

When `prefers-reduced-motion: reduce`:
- no pin;
- no scrub;
- render states in sequence;
- no content hidden by animation.

---

# 13. Invoicing chapter implementation

Create:
`InvoicingChapter`

ID:
`invoicing`

Copy exactly:

Eyebrow:
`PROFESSIONAL INVOICING`

H2:
`Compose the invoice once. Let the customer see exactly what you meant.`

Body:
`Build from reusable products and services or add an item on the fly. Set payment terms, add a customer reference, and preview the customer-facing invoice before it leaves your workspace.`

Visual requirements:
- editor/preview split;
- readable invoice paper;
- reusable catalogue action;
- two line items;
- payment terms;
- customer reference;
- total.

Animation:
- editor appears;
- invoice paper appears/settles;
- one line item enters and total updates;
- finish quickly.

Do not simulate recurring invoices/reminders.

---

# 14. Outcome Explorer implementation

Keep existing component behavior if practical.

Update copy container and visual system.

ID:
`reconciliation`

Section heading:

`Know what happened after checkout.`

Support:

`Matched payments stay simple. Real exceptions stay visible until they are resolved.`

Tabs:
- Matched
- Needs review
- Refund confirmed

Keep:
- keyboard arrow navigation;
- ARIA tab roles;
- real current scenarios.

Remove:
- blur-heavy transition.

Use:
- opacity;
- x translation <= 16px;
- 160–220ms.

---

# 15. Receivables visibility implementation

Replace `OperationsField` with:
`ReceivablesVisibility`

ID:
`visibility`

H2:
`See what needs attention before it becomes a surprise.`

Body:
`Outstanding balances, overdue invoices, confirmed collections, and real reconciliation issues share one operating view.`

Build one large product composition derived from app dashboard.

Use existing/shipped metrics:
- Outstanding;
- Overdue;
- Net collected;
- Needs attention;
- recent payment;
- aging/cashflow if useful.

Do not build four equal feature cards.

Optional supporting callouts:
- Current position
- Real exceptions
- Complete history

Maximum 3.

Animation:
- metrics reveal once;
- chart draws/reveals once;
- recent activity slides in;
- no endless number animation.

---

# 16. Customer payment chapter

Create:
`CustomerPaymentChapter`

ID:
`customer-payment`

Eyebrow:
`A BETTER WAY TO GET PAID`

H2:
`Give the customer one clear invoice and one clear next step.`

Body:
`Customers can open a public invoice without a Lumina account and pay online when your business payment setup is active.`

Visual:
- current public-invoice direction;
- business identity;
- amount due;
- due date;
- invoice document;
- payment panel;
- `Pay ₦78,400 online`;
- confirmed payment state.

Do not show:
- customer portal;
- saved cards;
- multiple open invoices;
- statement history.

---

# 17. Trust / control implementation

Replace `TrustArchitecture` with:
`TrustControls`

ID:
`trust`

H2:
`Financial clarity without becoming your bank.`

Body:
`Lumina keeps invoice and payment operations connected while Paystack handles the payment flow and your team keeps role-scoped control.`

Rows:

### Provider-confirmed payment status
`Payment state follows Paystack confirmation rather than optimistic UI state.`

### No business secret keys in the app
`Businesses do not paste Paystack secret keys into Lumina.`

### Masked payout context
`Operational views avoid exposing full payout account details.`

### Role-scoped access and audit history
`Team roles and audit logs keep sensitive actions accountable.`

Optional small visual:
- payment setup;
- audit entry;
- role badge.

Do not:
- draw central network topology;
- show fake security seals;
- claim PCI/ISO/SOC certification unless verified and real.

---

# 18. FAQ implementation

Retain existing truthful FAQ topics.

ID:
`faq`

Visual:
- light;
- clean;
- separated rows;
- no card wall.

Preserve accessible `details/summary` unless there is a strong reason to change.

---

# 19. Closing CTA

Replace current neon-lime close.

Create:
`ClosingCta` or refactor `SignupSection`.

Background:
`#245C46`

H2:
`Turn outstanding invoices into a workflow you can control.`

Body:
`Create your Lumina workspace and send your first professional invoice.`

Primary:
`Create account`

Secondary:
`Sign in`

Use white/warm text.

Optional tiny lime accent.

Do not show a large onboarding diagram unless it materially improves the composition.

---

# 20. Footer

Refactor `MarketingFooter`.

Light background.

Keep:
- logo;
- product anchors;
- trust;
- FAQ;
- sign in;
- privacy;
- terms;
- copyright.

No second giant CTA.

---

# 21. Legal pages

Privacy and Terms must migrate in the same PR.

Do not leave them dark.

Do not redesign their content.

Use:
- warm canvas;
- readable typography;
- no orbit decoration;
- green links;
- sensible line length.

---

# 22. Copy/data refactor

Update `apps/marketing/src/content/site-copy.ts`.

Do not leave old product menu types forcing:
- trail;
- outcomes;
- operations.

Refactor types around current sections.

Centralize demo data where practical so the same:
- invoice number;
- amount;
- reference;
- receipt;
- business/customer names
stay consistent.

Suggested object:

```ts
export const marketingDemo = {
  business: "Adebayo Studio",
  customer: "Northstar Projects",
  invoiceNumber: "INV-000184",
  total: "₦78,400",
  providerReference: "T8129-4F3A-90LX",
  receiptNumber: "RCT-000241"
}
```

Do not duplicate changing values across five files.

---

# 23. Styling migration rules

`globals.css` is currently large and dark.

Approach:

1. Replace root tokens first.
2. Restyle shared header/footer primitives.
3. Delete old section styles as components are replaced.
4. Add new section styles.
5. Perform a dead-style sweep.

Do NOT:
- retain the full dark theme commented out;
- leave unused old selectors;
- create `.light-v2` wrapper overrides;
- use `!important` to fight the old theme.

At completion:
- dark root tokens are gone;
- old orbit/topology classes are gone if no longer used.

---

# 24. Animation rules

Existing dependency:
`gsap`.

Do not add another animation library.

Use:

### CSS
- buttons;
- links;
- menu hover;
- small reveal states.

### GSAP
- hero entry only if helpful;
- Invoice → Cash;
- one-off product state transitions.

### ScrollTrigger
Mandatory for:
- desktop signature Invoice → Cash.

Do not create 20 independent ScrollTriggers.

Target:
- one major story timeline;
- small in-view triggers only where necessary.

No:
- constant parallax everywhere;
- cursor follower;
- smooth-scroll hijacking;
- Lenis unless already present (it is not);
- infinite marquee unless useful (not required);
- magnetic buttons;
- 3D tilt;
- mouse-follow gradients.

---

# 25. Accessibility requirements

Verify:

- all navigation by keyboard;
- Product dropdown;
- mobile menu;
- outcome tabs;
- FAQ;
- CTAs;
- signature content logical without motion;
- reduced-motion mode;
- color contrast;
- focus visibility.

Do not hide primary text inside `aria-hidden` visual stages.

Product demo visuals can be simplified for screen readers with useful labels.

---

# 26. Browser QA

You MUST use browser/computer-use inspection.

Do not finish from code review alone.

Inspect at:

- 1440 x ~900;
- 1280 x ~800;
- 768 x ~1024;
- 390 x ~844.

Also inspect:
- reduced motion.

Capture screenshots for at least:

1. hero desktop
2. hero mobile
3. signature CREATE
4. signature PAY
5. signature MATCH/KNOW
6. invoicing chapter
7. reconciliation explorer
8. visibility/dashboard
9. customer payment
10. trust section
11. closing CTA
12. full mobile progression

Review each screenshot against the section-specific references in `10_MARKETING_REFERENCE_LIBRARY.md`.

Perform at least one visual polish pass after screenshots.

---

# 27. Specific QA questions

Hero:
- Can I understand Lumina before looking at the product visual?
- Does invoice software read immediately?
- Is the invoice large enough to read?
- Is the composition inviting rather than technical?

Signature:
- Does one invoice visibly remain the same object?
- Can I tell what changed at every beat?
- Does the pinned section release naturally?
- Is there any scroll jump?
- Does resize break ScrollTrigger?
- Does mobile remain understandable without pinning?

Invoicing:
- Does it visibly reflect T020 rather than old v1?
- Is editor/preview relationship obvious?

Reconciliation:
- Are matched/review/refund visibly distinct without color alone?

Dashboard:
- Are the numbers readable?
- Is data secondary to the section story rather than decorative?

Public payment:
- Does it feel trustworthy to a payer?
- Is the CTA obvious?

Trust:
- Does this reassure a business owner without reading like architecture documentation?

Closing CTA:
- Is there one obvious action?

---

# 28. Functional regression constraints

Do not break:

- SEO metadata;
- JSON-LD;
- robots;
- sitemap;
- privacy;
- terms;
- signup/create-account links;
- login links;
- environment URL helpers;
- header mobile state;
- FAQ semantics.

Do not change `apps/api`.

Do not change financial logic in `apps/web`.

---

# 29. Testing

Run:

```bash
pnpm --filter @sme-invoicing/marketing lint
pnpm --filter @sme-invoicing/marketing typecheck
pnpm --filter @sme-invoicing/marketing test
pnpm --filter @sme-invoicing/marketing build
```

Then where practical:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Update tests when old copy/class assumptions change.

Prefer semantic assertions.

Do not test exact animation transforms.

---

# 30. Performance review

After implementation:

- inspect console for animation errors;
- verify no duplicate ScrollTriggers;
- verify cleanup on navigation/unmount;
- verify page remains smooth on mobile;
- check bundle changes;
- check that GSAP ScrollTrigger is only loaded client-side where needed;
- run Lighthouse if available.

Avoid avoidable CLS.

---

# 31. Dead-code cleanup

Search after redesign for:

- `color-scheme: dark`;
- `#070a08`;
- `hero-orbits`;
- `trail-route-main`;
- `trail-route-branch`;
- `trust-hub`;
- `trust-routes`;
- old full-lime signup styles;
- "Night graphite";
- old "Payment trail" product-menu item;
- old "Outcomes" product-menu item;
- old "Operations" product-menu item.

Delete obsolete implementation.

Do not leave dead CSS just because it is harmless.

---

# 32. PR description requirements

PR description must include:

## Summary
- new light Editorial Receivables direction;
- rebuilt hero;
- signature Invoice → Cash ScrollTrigger experience;
- T020 invoicing showcase;
- reconciliation/visibility/customer-payment chapters;
- trust and CTA migration;
- legal/light cleanup.

## Product truth
State explicitly that no unshipped T021+ functionality is marketed as live.

## Reference usage
List:
- Tola;
- Acctual;
- Column;
- Stripe;
- Lasso;
- PayFlexi;
- Mobbin invoice references;
and one sentence for how each influenced the result.

## Validation
Include:
- lint;
- typecheck;
- tests;
- build;
- browser breakpoints;
- reduced-motion QA;
- screenshots.

## Performance
Describe:
- ScrollTrigger use;
- mobile fallback;
- reduced motion;
- whether Lighthouse was run.

---

# 33. Required visual scorecard

Before opening the PR, execute every applicable check in `docs/lumina-v2/13_MARKETING_VISUAL_QA_SCORECARD.md`.

Any failed global pass/fail gate blocks completion.

# 34. Completion criteria

Do not open the PR until all of these are true:

- old dark marketing system is gone;
- light tokens are the actual implementation, not just docs;
- header is light;
- footer is light;
- legal pages are light;
- hero uses the locked copy;
- hero invoice is the dominant visual object;
- signature Invoice → Cash is implemented;
- ScrollTrigger is used cleanly;
- mobile signature story is purpose-built;
- T020 is represented accurately;
- reconciliation uses real current behavior;
- customer payment uses real current behavior;
- no fake portal/collections/recurring/AI functionality is shown;
- trust language is factual;
- old CSS has been cleaned;
- reference set was actively used;
- browser screenshots have been visually reviewed;
- reduced-motion path works;
- marketing lint/typecheck/test/build all pass.

Proceed with implementation now.
