# Lumina v2 — Marketing Site Evolution

**Status:** APPROVED FOR IMPLEMENTATION  
**Decision date:** 2026-09-18  
**Scope:** `apps/marketing`  
**Authority:** This is the canonical marketing art-direction and experience specification.

Companion implementation context:

1. `docs/lumina-v2/10_MARKETING_REFERENCE_LIBRARY.md`
2. `docs/lumina-v2/11_CURRENT_MARKETING_UI_AUDIT.md`
3. `docs/lumina-v2/12_MARKETING_REDESIGN_CODEX_PROMPT.md`
4. `docs/lumina-v2/13_MARKETING_VISUAL_QA_SCORECARD.md`
4. `docs/lumina-v2/06_APP_DESIGN_OVERHAUL.md` for brand relationship with the authenticated app
5. `docs/lumina-v2/07_MOBBIN_APP_REFERENCE_LIBRARY.md` for actual product UI references

If an older marketing document conflicts with this file, this file wins.

---

# 1. Decision

PR #22 has now established Lumina's authenticated product as a **light financial workspace**.

The marketing site must now evolve to match that product.

The new marketing direction is:

> **Editorial Receivables**

Lumina marketing should feel like a premium editorial presentation of real receivables software.

It must be:

- light;
- financially trustworthy;
- inviting to business owners;
- credible to finance teams;
- product-led;
- document-led;
- visually authored;
- rich in scroll interaction;
- considerably more expressive than the authenticated app;
- grounded in actual shipped Lumina behavior.

It must not feel like:

- a dark developer tool;
- crypto infrastructure;
- an abstract fintech concept site;
- a generic SaaS template;
- a landing page made of equal feature cards;
- an animation reel with weak product comprehension.

---

# 2. Brand relationship

The app and marketing site should clearly belong to the same company.

## Authenticated app

The app is:

- calm;
- operational;
- compact;
- restrained;
- low-motion;
- optimized for repeated financial work.

## Marketing

Marketing is:

- editorial;
- spacious;
- kinetic;
- narrative;
- product-demonstrative;
- optimized for understanding and conversion.

Shared DNA:

- warm off-white canvas;
- white surfaces;
- deep Lumina green;
- dark ink;
- Hanken Grotesk;
- tabular financial numerals;
- semantic status colors;
- realistic product UI;
- no decorative crypto gradients.

The marketing site may use more scale, overlap, motion, color fields, and whitespace than the app.

---

# 3. Locked marketing palette

Use these as the starting tokens.

```text
Canvas               #F6F7F4
Canvas Warm          #FAFAF7
Paper                #FFFFFF
Surface Soft         #F0F2EF
Soft Sage            #EAF3ED
Soft Blue            #EAF2F8

Ink                  #17211C
Ink Secondary        #4F5F56
Ink Muted            #768078

Brand Green          #245C46
Brand Green Hover    #1B4A38
Signal Lime          #C1FF72

Success              #237A57
Warning              #956800
Danger               #B54747
Info                 #2F6F9F

Border Subtle        #E8EBE6
Border Default       #DCE2DC
```

Rules:

- light backgrounds dominate;
- primary CTAs use deep green, not lime;
- lime is a signal, not the environment;
- lime may appear at decisive financial moments such as "paid", "matched", active trail progress, or a small CTA accent;
- one deep-green full-width closing section is allowed;
- black full-screen sections are not part of this direction;
- gradients are not needed for the core identity;
- soft sage and soft blue are used for chapter rhythm, not random decoration.

---

# 4. Typography

Keep:

- Hanken Grotesk;
- JetBrains Mono only for invoice numbers, payment references, receipt IDs, timestamps, and selected data labels.

Do not introduce a new display font during this implementation.

## Display behavior

- hero: `clamp(3.4rem, 7.5vw, 7rem)`;
- line-height approximately `0.92–0.98`;
- negative tracking approximately `-0.03em`;
- use editorial line breaks intentionally;
- avoid overly centered corporate presentation.

## Body

- 16–20px depending on section;
- generous line-height;
- concise business language;
- avoid infrastructure jargon in primary marketing copy.

---

# 5. Product truth boundary

The redesign must show what exists today.

## Safe to present as shipped

- reusable products/services;
- professional invoice authoring;
- ad-hoc invoice lines;
- payment terms;
- customer reference / PO;
- customer memo;
- live invoice preview;
- draft/send workflow;
- public invoice;
- Paystack payment initialization;
- partial/full payment state;
- provider-confirmed payment truth;
- reconciliation;
- review-required state;
- overpayment;
- refund workflow;
- immutable receipts;
- dashboard metrics;
- outstanding/overdue visibility;
- exports;
- audit logs;
- roles/team;
- payment setup.

## Not safe to present as shipped yet

- automatic reminder sequences;
- recurring invoices;
- collections workspace;
- promise to pay;
- Customer 360;
- customer portal;
- disputes;
- cash forecasting;
- AI collections;
- AI reconciliation;
- NRS integration;
- multi-currency;
- accounting/ERP integrations.

Do not create fake UI for unshipped features.

---

# 6. Locked marketing message

Primary proposition:

> **Turn every invoice into predictable cash.**

Supporting line:

> **Create professional invoices, collect payments, reconcile what arrived, and know exactly what needs attention.**

Audience:

> **Built for growing Nigerian businesses and the people responsible for getting them paid.**

Supporting shorthand:

> **Invoice. Pay. Reconcile. Know.**

This shorthand may be used as a visual motif, but not as the hero headline.

---

# 7. Locked homepage architecture

The homepage should follow this exact sequence unless implementation constraints justify a small local adjustment.

```text
00 Header
01 Hero
02 Audience bridge
03 Signature Invoice → Cash story
04 Invoicing chapter
05 Payment outcomes / reconciliation explorer
06 Receivables visibility
07 Customer payment experience
08 Trust & control
09 FAQ
10 Closing CTA
11 Footer
```

Do not add more homepage sections merely because a reference has them.

Do not add customer logos, testimonials, pricing, case studies, resources, or comparison grids unless real content exists.

---

# 8. Header

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

Behavior:

- fixed/sticky;
- starts light/transparent;
- receives a subtle white/warm background and border after scroll;
- no dark floating capsule;
- Product dropdown stays compact;
- no elaborate dark preview pane;
- mobile uses simple accordion/drawer behavior;
- preserve keyboard/focus/escape behavior.

Primary CTA:
`Create account`

No pricing link until pricing exists.

---

# 9. Hero

## Content

Eyebrow:

> **RECEIVABLES FOR GROWING BUSINESSES**

Headline:

> **Turn every invoice into predictable cash.**

Support:

> **Create professional invoices, collect payments, reconcile what arrived, and know exactly what needs attention.**

Primary CTA:

> **Create account**

Secondary:

> **See how it works**

Trust note:

> **Built for NGN invoicing and Paystack payment flows.**

## Layout

Desktop:
- left/upper-left copy block;
- product composition occupies 50–60% of visual field;
- one invoice is the dominant object;
- supporting dashboard/payment states sit behind or adjacent;
- asymmetrical, not centered-template style.

Mobile:
- copy first;
- CTAs;
- one readable invoice visual;
- no tiny overlapping windows.

## Hero visual

Replace the old all-at-once Payment Trail mosaic.

New hero scene:

- invoice document in foreground;
- invoice editor or dashboard edge behind;
- one small matched/payment state;
- realistic Lumina data;
- no more than three layers.

Hero motion:
- headline/copy stagger: 350–650ms;
- product scene enters with 12–24px translate + opacity;
- secondary layers settle after primary document;
- no blur-heavy entrance;
- no looping hero motion that distracts from reading.

---

# 10. Audience bridge

Purpose:
explain who Lumina is for without fabricated social proof.

Copy direction:

```text
For the people who turn finished work into cash.

Growing businesses
Agencies & professional services
Finance & receivables teams
```

Presentation:
- simple text-led band;
- subtle divider;
- small supporting statements;
- no fake logos;
- no invented user counts.

This section should be short.

---

# 11. Signature experience — Invoice to Cash

This is the main authored interaction.

ID:
`how-it-works`

Working component:
`InvoiceToCashStory`

## Canonical narrative

```text
CREATE
→ SHARE
→ PAY
→ VERIFY
→ MATCH
→ KNOW
```

Use one continuous financial object.

Canonical synthetic data:

```text
Business: Adebayo Studio
Customer: Northstar Projects
Invoice: INV-000184
Total: ₦78,400
Provider reference: T8129-4F3A-90LX
Receipt: RCT-000241
Final balance: ₦0
```

Do not randomly change names/amounts between stages.

## Desktop structure

Recommended:
- 360–440vh section;
- visual stage pinned;
- textual step rail scrolls;
- 6 equal-ish beats;
- visual stays inside a normal max-width page frame;
- do not pin the entire header/page.

### CREATE

Product state:
- invoice editor;
- selected customer;
- catalogue/ad-hoc items;
- total;
- live preview.

Copy:
`Build the invoice with the details your customer actually needs.`

### SHARE

Product state:
- editor chrome reduces;
- invoice document becomes dominant;
- public invoice/share state appears.

Copy:
`Send one clear document instead of another email attachment chain.`

### PAY

Product state:
- customer-facing invoice;
- amount due;
- Paystack payment CTA.

Copy:
`Your customer sees what is due and has one clear next step.`

### VERIFY

Product state:
- payment confirmation;
- reference enters;
- provider confirmation status.

Copy:
`Lumina waits for provider-confirmed payment truth.`

Do not headline webhook/signature implementation details.

### MATCH

Product state:
- provider reference connects to invoice;
- status becomes matched;
- balance becomes `₦0 due`.

Copy:
`The payment resolves against the invoice instead of becoming another mystery transfer.`

### KNOW

Product state:
- receipt appears;
- invoice/receipt compress into dashboard state;
- paid state;
- updated operational metrics.

Copy:
`The invoice, payment, receipt, and business position stay connected.`

## Motion

Use GSAP + ScrollTrigger.

- scrub for primary state progression;
- transforms + opacity + clip-path;
- no rotation gimmicks;
- no springy bounce;
- no glow;
- no frame-by-frame React state;
- avoid animating layout properties when transform works;
- keep text DOM order logical.

## Mobile

No pinning.

Use:
- six vertical story cards/chapters;
- each product state appears after its copy;
- short in-view translate/opacity;
- visual continuity through consistent invoice number and paper treatment.

## Reduced motion

- no scrub;
- no pin;
- all six states remain available in reading order;
- optional short fades only.

---

# 12. Invoicing chapter

ID:
`invoicing`

Headline:

> **Compose the invoice once. Let the customer see exactly what you meant.**

Body:

> **Build from reusable products and services or add an item on the fly. Set payment terms, add a customer reference, and preview the customer-facing invoice before it leaves your workspace.**

Visual:
- editor/preview split;
- full document preview;
- catalogue picker appears contextually;
- line item changes update preview;
- product visuals derive from merged PR #22 UI.

Composition:
- one dominant product surface;
- no equal cards;
- allow product UI to extend beyond content column slightly on desktop.

Motion:
- section heading reveal;
- editor enters;
- preview slides/settles;
- one line item may animate into the preview to demonstrate cause/effect.

Do not make the section a form tutorial.

---

# 13. Payment outcomes / reconciliation explorer

ID:
`reconciliation`

Headline:

> **Know what happened after checkout.**

Support:

> **Matched payments stay simple. Real exceptions stay visible until they are resolved.**

Retain three states:

1. Matched
2. Needs review
3. Refund confirmed

Use the existing accessible tabs pattern.

Visual:
- open editorial split;
- financial amount;
- payment/invoice references;
- current state;
- concise next action.

Animation:
- 160–220ms;
- opacity + x translation;
- no blur.

No ScrollTrigger pinning here.

---

# 14. Receivables visibility

ID:
`visibility`

Headline:

> **See what needs attention before it becomes a surprise.**

Support:

> **Outstanding balances, overdue invoices, confirmed collections, and real reconciliation issues share one operating view.**

Primary visual:
- merged Lumina overview/dashboard;
- large central panel;
- realistic implemented data.

Show:
- outstanding;
- overdue;
- net collected;
- needs attention;
- recent matched payment;
- aging/cashflow if space allows.

Motion:
- metrics count or settle once;
- chart reveal once;
- recent payment row slides in;
- do not continuously animate finance values.

---

# 15. Customer payment experience

ID:
`customer-payment`

Eyebrow:

> **A BETTER WAY TO GET PAID**

Headline:

> **Give the customer one clear invoice and one clear next step.**

Body:

> **Customers can open a public invoice without a Lumina account and pay online when your business payment setup is active.**

Visual:
- public invoice;
- amount due;
- due date;
- merchant identity;
- `Pay ₦78,400 online` CTA;
- payment confirmation state.

Motion:
- invoice sheet enters as paper;
- payment panel docks beside it;
- confirmed state replaces CTA after a short demonstration.

Do not show a customer portal.

---

# 16. Trust and control

ID:
`trust`

Headline:

> **Financial clarity without becoming your bank.**

Support:

> **Lumina keeps invoice and payment operations connected while Paystack handles the payment flow and your team keeps role-scoped control.**

Use these real control statements:

- **Provider-confirmed payment status**  
  Payment state follows Paystack confirmation rather than optimistic UI state.

- **No business secret keys in the app**  
  Businesses do not paste Paystack secret keys into Lumina.

- **Masked payout context**  
  Operational views avoid exposing full payout account details.

- **Role-scoped access and audit history**  
  Team roles and audit logs keep sensitive actions accountable.

Presentation:
- text-led;
- structured rows or columns;
- one small payment-setup/audit visual;
- no central network hub;
- no pseudo-security badges;
- no invented certifications.

---

# 17. FAQ

Keep current FAQ topics where still accurate.

Required questions include:

- Does Lumina hold my funds?
- Do I provide my Paystack secret key?
- How does Lumina know an invoice was paid?
- What happens if a customer pays twice?
- Can customers pay without an account?
- Is Lumina accounting software?
- Which country/currency is currently supported?

Design:
- simple separators;
- open/close disclosure;
- no large cards.

---

# 18. Closing CTA

Use the single strongest brand field.

Background:
- Brand Green `#245C46`

Text:
- white / warm white

Optional accent:
- small lime signal

Headline:

> **Turn outstanding invoices into a workflow you can control.**

Support:

> **Create your Lumina workspace and send your first professional invoice.**

Primary:
`Create account`

Secondary:
`Sign in`

Do not repeat a detailed 3-step onboarding flow unless it remains visually simple.

---

# 19. Footer

Light footer.

- warm/off-white background;
- brand;
- short descriptor;
- product anchors;
- Trust;
- FAQ;
- Sign in;
- Privacy;
- Terms.

Do not use a second giant CTA.

---

# 20. Section color rhythm

Recommended page rhythm:

```text
Header                  warm transparent / white
Hero                    Canvas Warm
Audience                Canvas Warm
Invoice → Cash          White
Invoicing               Soft Sage
Reconciliation          Canvas Warm
Visibility              White
Customer payment        Soft Blue
Trust                   Canvas Warm
FAQ                     White
Closing CTA             Brand Green
Footer                   Canvas Warm
```

This is directional but should stay close.

Do not alternate colors mechanically every section.
Use transitions to create chapters.

---

# 21. Motion system

Motion should be noticeable but authored.

## Level 1 — micro

Use CSS:
- hover;
- focus;
- button arrow;
- nav dropdown;
- tab state;
- small product control response.

Duration:
120–220ms.

## Level 2 — section entrance

Use CSS or GSAP:
- masked/clip heading;
- 12–24px translate;
- product layer settling;
- opacity.

Duration:
350–700ms.

Do not apply the same fade-up utility to every element.

## Level 3 — signature scroll

Use GSAP ScrollTrigger only for:
- Invoice → Cash;
- optionally one small reconciliation/dashboard transition if genuinely necessary.

Prefer one excellent pinned story over several average pinned sections.

---

# 22. Performance constraints

- no autoplay background video as primary product proof;
- no large canvas/WebGL;
- no Three.js;
- no 3D library;
- no animation library beyond existing GSAP unless explicitly approved;
- lazy-load below-fold heavy client components if useful;
- no React state update per animation frame;
- transforms/opacity first;
- clean up ScrollTriggers on unmount;
- refresh ScrollTrigger on meaningful resize/layout changes;
- avoid CLS from animation setup.

Goal:
marketing should still feel fast on a midrange mobile device.

---

# 23. Responsive rules

## Desktop >= 1200

Allowed:
- overlap;
- wide product compositions;
- pinned signature sequence;
- large type;
- product layers.

## Tablet 768–1199

- reduce overlap;
- reduce pin duration or disable if unstable;
- retain strong visual hierarchy;
- make product surfaces readable.

## Mobile < 768

- no desktop pin choreography;
- one column;
- product UI simplified;
- no tiny dashboard replicas;
- avoid horizontal scroll except intentional small control rails;
- 44px+ controls;
- product visuals should use cropped/selected information rather than shrinking entire desktop screens.

---

# 24. Accessibility

- semantic DOM order must match reading order;
- every interactive scenario must work by keyboard;
- header menus preserve current accessibility;
- reduced-motion path is mandatory;
- no content should require animation completion;
- color is never the only status signal;
- maintain AA contrast for copy/controls;
- decorative animated elements use `aria-hidden`;
- product demo regions need useful labels but should not overwhelm screen readers with every decorative value.

---

# 25. SEO / functional constraints

Preserve:

- metadata;
- structured data;
- sitemap;
- robots;
- legal pages;
- sign-in URL handling;
- create-account URL handling;
- marketing anchor helpers;
- existing environment-aware root/app URL behavior.

Do not change application/backend contracts for the marketing redesign.

---

# 26. Reference policy

Mandatory research before coding:

Read:
- `10_MARKETING_REFERENCE_LIBRARY.md`.

At minimum inspect:
- Tola;
- Acctual;
- Column;
- Stripe 2026;
- Lasso;
- PayFlexi Pinterest;
- merged Lumina app;
- Stripe/Mercury/Airwallex Mobbin invoice flows.

For each major section, follow the explicit reference-to-section mapping in `10`.

Do not browse randomly after that unless a concrete implementation problem remains.

---

# 27. Implementation order

One PR.

```text
MKT-01A  Foundation + token migration
MKT-01B  Header + footer + global shell
MKT-01C  Hero
MKT-01D  Signature Invoice → Cash
MKT-01E  Invoicing chapter
MKT-01F  Reconciliation explorer
MKT-01G  Receivables visibility
MKT-01H  Customer payment
MKT-01I  Trust + FAQ + closing CTA
MKT-01J  Legal migration + dead CSS cleanup
MKT-01K  Responsive / reduced-motion / accessibility QA
MKT-01L  Browser polish and PR
```

Do not stop after MKT-01C and call the redesign complete.

---

# 28. Definition of done

The redesign is complete only when:

- marketing no longer renders the old dark system;
- `color-scheme: dark` is gone from marketing;
- hero clearly explains invoicing/receivables;
- an invoice is the primary visual object;
- the signature lifecycle is genuinely scroll-authored on desktop;
- mobile has its own deliberate story;
- merged app design and marketing visuals feel related;
- T020 invoice quality is represented;
- no unshipped feature is presented as live;
- old orbit/network/topology visual language is removed;
- no generic repeated feature-card homepage remains;
- legal pages are light;
- header/footer are light;
- reduced motion works;
- browser QA is completed at 1440 / 1280 / 768 / 390;
- lint/typecheck/tests/build pass;
- screenshots are reviewed and at least one polish pass follows visual inspection.
