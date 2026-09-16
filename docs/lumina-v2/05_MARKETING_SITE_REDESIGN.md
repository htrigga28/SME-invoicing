# Lumina v2 — Marketing Site Redesign

**Status:** APPROVED FOR IMPLEMENTATION  
**Decision date:** 2026-09-16  
**Scope:** `apps/marketing` only unless this document explicitly references the authenticated product.  
**Purpose:** Give Codex a concrete replacement for the current dark-first marketing direction without starting another design-planning cycle.

---

## 1. Decision Summary

Lumina marketing should move away from the current dark graphite + neon-lime visual world.

The new direction is a **light, warm, inviting editorial-fintech experience** aimed at business owners, finance teams, accountants, agencies, professional-services firms, and larger receivables teams.

The site should feel:

- financially trustworthy;
- modern without looking crypto-adjacent;
- warm enough for SMEs;
- credible enough for finance managers;
- product-led rather than illustration-led;
- polished enough to work as a high-quality portfolio piece;
- significantly more dynamic during scroll than a typical B2B SaaS landing page.

The existing **Payment Trail** concept remains useful, but its expression changes completely:

> The trail should no longer be a glowing line on a dark canvas. It should become a continuous product story in which an invoice visibly moves through creation, delivery, collection, payment, reconciliation, receipt, and cash visibility as the visitor scrolls.

This document supersedes the previous assumption in `apps/marketing/DESIGN.md` that the marketing world must remain dark.

---

## 2. Marketing Thesis

Primary working promise:

> **Turn every invoice into predictable cash.**

Supporting product story:

> Create professional invoices, follow up automatically, accept payments, reconcile what arrived, and know what needs attention next.

Supporting positioning:

- For small businesses: **Send invoices. Get paid. Stop chasing.**
- For finance teams: **Know what is owed, what is late, and what needs attention.**
- Long term: **Automate invoice-to-cash without replacing the systems your business already uses.**

Do not present Lumina as generic bookkeeping, banking, payroll, or all-in-one business software.

---

## 3. Visual Direction

### Overall aesthetic

Use a light editorial-fintech system built from:

- warm off-white page backgrounds;
- white document/product surfaces;
- deep green/ink typography;
- pale sage and pale blue section fields;
- restrained borders;
- subtle ambient shadows;
- controlled use of Lumina lime as an action/highlight color rather than the page environment;
- real-looking Lumina product UI as the dominant visual asset.

Avoid:

- black/charcoal as the default page background;
- neon glow effects;
- crypto-style gradients;
- excessive glassmorphism;
- equal feature-card grids as the main storytelling device;
- giant generic 3D objects unrelated to receivables;
- decorative motion that does not explain the product.

### Starting palette

These are directional tokens, not a requirement to hard-code exact values if accessibility/testing suggests adjustment:

```text
Canvas / warm neutral    #F7F7F2
Paper                    #FFFFFF
Soft sage                #E7EFE6
Soft blue                #E9F1F7
Ink                      #17211C
Muted ink                #68746D
Brand green              #275C46
Action lime              #B7E56B
Review / amber           #D89B3C
Danger / coral           #C85D57
```

Rules:

- White/off-white should dominate.
- Green should feel established and financial, not fluorescent.
- Lime should be reserved for primary CTA, active trail moments, and selective emphasis.
- Pale sage/blue should create section rhythm and visual relief.
- Semantic state colors remain semantic.

---

## 4. Typography

The existing Hanken Grotesk can remain if it still works after the redesign.

Target behavior:

- Large, confident but not shouty display typography.
- Dark ink rather than white display text.
- Strong editorial line breaks.
- Body copy should be readable and businesslike, not overly technical.
- JetBrains Mono may remain for product references, invoice IDs, amounts, timestamps, and demo-data labels.
- Do not turn all financial data into monospaced typography.

Hero and section headings should feel closer to premium financial software than developer tooling.

---

## 5. Reference Set

Codex has access to Mobbin MCP. Inspect these references directly before implementing the redesign.

### Ramp — restraint and whitespace

Mobbin section:
https://mobbin.com/sites/sections/83a61ac1-4ad8-48d0-91be-13ac7b374e22

Borrow:

- white-space confidence;
- simple navigation;
- decisive headline hierarchy;
- light financial-product feel;
- product/object focus without excessive surrounding decoration.

Do not copy Ramp's exact visual identity.

### Stripe — visual confidence and product storytelling

Mobbin section:
https://mobbin.com/sites/sections/033e268c-5938-4b45-97c3-4f355f1a63c8

Borrow:

- large-scale product confidence;
- strong type hierarchy;
- clear product proof near the hero;
- transitions between business promise and real product capability.

Avoid copying Stripe's color language or decorative ribbon motif.

### Monarch — approachable finance tone

Mobbin section:
https://mobbin.com/sites/sections/24964640-6293-40e9-994e-591814a32ec5

Borrow:

- inviting financial-product tone;
- soft color use;
- approachable product framing;
- obvious product UI without visual intimidation.

Lumina must remain more B2B and operational than Monarch.

### Sequence — soft B2B finance presentation

Mobbin section:
https://mobbin.com/sites/sections/ca1841d9-bfa2-43c6-ad49-ba6eceddf894

Borrow:

- soft light background treatment;
- mature B2B finance tone;
- editorial headline treatment;
- product UI embedded in a calm visual field.

### Existing product references

For actual Lumina UI shown inside marketing compositions, also use the product references already listed in `02_UI_UX_DIRECTION.md`, especially Stripe, Mercury, Midday, Xero, and Airwallex.

The marketing site should show the **future Lumina v2 UI direction**, not freeze itself around outdated v1 screenshots.

---

## 6. Core Homepage Narrative

The homepage should not be a sequence of generic feature blocks. It should behave like one continuous demonstration of the receivables lifecycle.

Recommended structure:

### 1. Hero — outcome first

Goal: immediately communicate the value proposition and show Lumina as a real product.

Suggested hierarchy:

```text
Turn every invoice
into predictable cash.

Create invoices, follow up automatically,
collect payments and know what needs attention next.

[Create account]   [See how it works]
```

Visual:

- large Lumina product composition;
- invoice/document surface in the foreground;
- subtle receivables/dashboard context behind it;
- light page field;
- no dark full-screen backdrop;
- motion on load should be controlled and fast.

### 2. Credibility / audience bridge

Explain who Lumina is built for without fake customer logos or fabricated proof.

Possible audience line:

- Growing businesses.
- Agencies and professional services.
- Finance and receivables teams.

If real proof does not exist, do not invent customer logos, transaction volumes, awards, or adoption metrics.

### 3. Signature scroll sequence — Invoice to Cash

This is the main cinematic section.

Narrative:

```text
CREATE
Invoice is assembled
↓
SEND
Customer-facing document becomes active
↓
COLLECT
Reminder and communication events appear
↓
PAY
Payment confirmation enters the trail
↓
RECONCILE
Payment resolves against the invoice
↓
KNOW
Dashboard / customer account / expected-cash state updates
```

This should feel like one connected system rather than six disconnected screenshots.

### 4. Collections — stop chasing manually

Use a pinned or staged Collections workspace.

Story:

- accounts needing attention appear;
- overdue balance becomes clear;
- reminder action or promise-to-pay event enters;
- list reprioritizes or resolves as state changes.

### 5. Reconciliation — money becomes truth

Visually demonstrate:

```text
Payment arrives
→ reference/customer/amount evaluated
→ matched to invoice
→ invoice balance changes
→ receipt becomes available
```

Keep this understandable to a business owner. Do not make the section read like payment-infrastructure documentation.

### 6. Customer experience / portal

Show the customer's side:

- clean invoice;
- amount due;
- payment CTA;
- receipt/statement access;
- account overview when portal support exists.

### 7. Visibility — know what happens next

Transition from individual invoice to overall receivables visibility:

- outstanding;
- overdue;
- aging;
- accounts needing attention;
- later: expected cash / DSO.

### 8. Control / trust

Communicate real existing or approved capabilities only:

- team roles;
- payment/reconciliation traceability;
- audit history;
- secure payment-provider integration;
- receipts;
- future compliance only when actually available or explicitly labelled as future/roadmap.

### 9. Product ecosystem

Present the connected product areas without a generic six-card grid if a more editorial layout works:

- Invoicing;
- Collections;
- Payments;
- Reconciliation;
- Customer accounts;
- Insights.

### 10. Closing CTA

Return to the core outcome:

> Turn outstanding invoices into a workflow you can actually control.

Primary CTA should be singular and obvious.

---

## 7. Motion and Scroll Choreography

Motion is a major part of the new marketing direction, but it must explain product behavior.

### Primary motion patterns

#### Sticky product storytelling

Keep one Lumina product surface pinned while copy/state changes as the user scrolls.

Use for:

- invoice-to-cash sequence;
- collections;
- reconciliation.

#### Object continuity

Where feasible, keep one identifiable invoice/document/payment object present across multiple scroll beats so the visitor sees state transformation rather than unrelated screenshots.

#### Masked/revealed typography

Section headings may reveal through masks/clips when entering major chapters.

Use selectively; do not animate every heading identically.

#### Layered product surfaces

Product cards, payment events, messages, receipts, and dashboard panels may stack or slide into place as the financial trail evolves.

#### Animated data

Animate values/charts only when the change communicates the story:

- overdue decreases;
- paid amount increases;
- matched state resolves;
- dashboard totals update.

Do not use fake metrics as visual decoration.

#### Subtle parallax

Use small depth differences for document sheets/background fields where it improves spatial composition.

#### Scroll-linked progress

A restrained line/progress indicator may represent the Payment Trail through a signature section.

It must be secondary to the product itself.

#### Section color transitions

Move between warm canvas, white, soft sage, and soft blue to provide chapter rhythm.

Avoid every section being enclosed in a separate rounded container.

---

## 8. Motion Technology

Preferred implementation approach:

- Use **Motion** for standard component entrance/exit, hover, micro-interactions, and light in-view transitions.
- Use **GSAP + ScrollTrigger** only for the signature pinned/scroll-linked sequences that genuinely need timeline control.
- Do not rebuild ordinary UI animation in GSAP when CSS/Motion is sufficient.
- Avoid large animation dependencies for effects that can be done with CSS.

### Performance rules

- Animate transforms and opacity wherever possible.
- Avoid scroll listeners that trigger React renders on every frame.
- Lazy-load heavy visual sequences below the fold where appropriate.
- Avoid large autoplay videos unless they have a clear benefit over live HTML/CSS product demonstrations.
- Protect Core Web Vitals.

---

## 9. Responsive Motion

Desktop and mobile do not require effect parity.

### Desktop

Can use:

- sticky/pinned sections;
- layered windows;
- lateral motion;
- scroll-linked transformations;
- richer product choreography.

### Tablet

Reduce layer count and pinned duration.

### Mobile

Do not shrink the desktop choreography.

Instead:

- convert horizontal compositions to vertical sequences;
- reduce or remove long pinned sections;
- use short in-view transitions;
- preserve object continuity through stacked states;
- keep product text/data readable;
- prioritize performance and touch scrolling.

Mobile must remain polished even when it uses simpler motion.

---

## 10. Reduced Motion and Accessibility

Every signature sequence must have a `prefers-reduced-motion` path.

Reduced-motion mode should:

- remove scrubbed/parallax motion;
- show states directly or use short fades;
- preserve all text/content;
- preserve logical reading order;
- never hide information behind animation completion.

Keyboard users and screen readers must receive content in sensible DOM order regardless of visual pinning.

---

## 11. Product UI Inside Marketing

Marketing visuals should be built from realistic Lumina interfaces, not generic fake dashboard art.

Rules:

- Product surfaces must reflect the actual/future approved domain model.
- Use realistic demo data and label synthetic data where necessary.
- Do not display impossible product capabilities as if already shipped.
- It is acceptable for marketing compositions to use purpose-built product-demo components rather than literal screenshots if they accurately represent the product direction.
- Keep customer-facing invoice/payment surfaces lighter and more document-like than internal operational views.

---

## 12. Header / Navigation Direction

Use a light header/navigation system.

Desktop:

- compact logo;
- Product;
- Solutions;
- Resources when useful;
- Pricing when real;
- Sign in;
- one primary CTA.

Do not make the nav itself a visual spectacle.

If Product uses an expanded panel, it should preview real areas such as:

- Invoicing;
- Collections;
- Payments & reconciliation;
- Customer portal;
- Insights.

Mobile should use a simple drawer/accordion and never depend on hover.

---

## 13. Component and Layout Rules

Do:

- use generous whitespace;
- use product UI as visual proof;
- vary section density and composition;
- let certain sections be mostly typography and space;
- use large screenshots/product compositions without trapping all of them in identical cards;
- use subtle paper/document metaphors where appropriate to invoicing.

Do not:

- create one reusable `FeatureCard` and build the whole homepage from it;
- wrap every section in a rounded rectangle;
- use the same fade-up animation everywhere;
- use lime borders around every element;
- use large gradients merely to make empty areas look designed;
- use irrelevant stock imagery.

---

## 14. Implementation Sequence for the Marketing Redesign

This work can run as its own implementation task and does **not** require another research/planning gate.

### Pass 1 — Foundation

- Replace dark-first marketing tokens with the new light system.
- Rework page background and typography.
- Rebuild header/navigation.
- Rebuild hero.
- Establish new section spacing/rhythm.
- Preserve existing SEO, structured data, routes, signup/waitlist behavior, and analytics behavior.

### Pass 2 — Signature Payment Trail

- Build the invoice-to-cash scroll sequence.
- Use real Lumina demo states.
- Add reduced-motion behavior.
- Add mobile alternative choreography.

### Pass 3 — Product Chapters

- Collections section.
- Reconciliation section.
- Customer/payment experience.
- Visibility/insights section.
- Trust/control section.

### Pass 4 — Polish

- Responsive QA.
- Scroll timing.
- Typography refinement.
- State transitions.
- performance profiling;
- reduced-motion QA;
- accessibility QA;
- final browser screenshot review.

Do not wait for all future product features to exist before redesigning the marketing site. Where a future section would misrepresent unshipped functionality, either omit it, label it accurately, or use currently implemented capability.

---

## 15. Browser QA Requirements

Codex should inspect at minimum:

- 1440px desktop;
- 1280px laptop;
- 768px tablet;
- 390px mobile.

Review:

- hero hierarchy;
- readability on bright/light backgrounds;
- product UI legibility;
- sticky section start/end behavior;
- scroll-jank;
- overlap/z-index problems;
- content clipping;
- long-copy wraps;
- CTA visibility;
- motion timing;
- reduced-motion fallback;
- keyboard navigation;
- mobile scroll feel;
- Lighthouse/Core Web Vitals regressions where practical.

Take browser screenshots at important breakpoints and compare the overall quality against the reference set rather than comparing pixel-for-pixel.

---

## 16. Definition of Done

The redesign is successful when:

- Lumina no longer reads as a dark developer-tool/crypto-style fintech brand;
- the site feels welcoming to business and finance customers;
- the first viewport clearly explains the product outcome;
- real product UI appears early and remains central to the story;
- scrolling visibly demonstrates the invoice-to-cash lifecycle;
- motion feels authored rather than templated;
- mobile remains deliberate and performant;
- the website and authenticated product feel related without being visually identical;
- no existing signup, SEO, routing, or product-integrity behavior regresses.
