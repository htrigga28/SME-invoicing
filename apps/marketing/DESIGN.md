---
name: Lumina Marketing — Editorial Receivables
description: A light, product-led, document-led marketing system for invoicing and receivables.
colors:
  canvas: "#F6F7F4"
  canvas-warm: "#FAFAF7"
  paper: "#FFFFFF"
  surface-soft: "#F0F2EF"
  sage: "#EAF3ED"
  blue-soft: "#EAF2F8"
  ink: "#17211C"
  ink-secondary: "#4F5F56"
  ink-muted: "#768078"
  brand: "#245C46"
  brand-hover: "#1B4A38"
  signal: "#C1FF72"
  success: "#237A57"
  warning: "#956800"
  danger: "#B54747"
typography:
  display:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(3.4rem, 7.5vw, 7rem)"
    fontWeight: 620
    lineHeight: 0.94
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 450
    lineHeight: 1.7
  data:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
---

# Lumina Marketing Design System

## Authority

Read these before changing the marketing site:

1. `docs/lumina-v2/05_MARKETING_SITE_REDESIGN.md`
2. `docs/lumina-v2/10_MARKETING_REFERENCE_LIBRARY.md`
3. `docs/lumina-v2/11_CURRENT_MARKETING_UI_AUDIT.md`
4. `docs/lumina-v2/12_MARKETING_REDESIGN_CODEX_PROMPT.md`

If this file conflicts with those, `05_MARKETING_SITE_REDESIGN.md` wins for art direction and `12_MARKETING_REDESIGN_CODEX_PROMPT.md` wins for execution.

The old dark graphite + neon-lime marketing world is **SUPERSEDED**.

---

# Creative North Star

Working direction:

> **Editorial Receivables**

Lumina marketing should look like the premium editorial expression of the real Lumina application.

The primary visual object is the **invoice/document**.

The central story is:

```text
CREATE
→ SHARE
→ PAY
→ VERIFY
→ MATCH
→ KNOW
```

This is a product lifecycle, not a decorative line diagram.

---

# Relationship to the product app

The authenticated app is:
- calm;
- operational;
- compact;
- low-motion.

Marketing is:
- spacious;
- narrative;
- kinetic;
- product-demonstrative.

Shared:
- warm light canvas;
- white working surfaces;
- deep green;
- dark ink;
- Hanken Grotesk;
- real financial state;
- restrained semantic colors.

Marketing may use:
- larger typography;
- more overlap;
- more paper/document layering;
- more scroll motion;
- larger chapter color changes.

Marketing must not invent a different fake product UI.

---

# Color

## Base

- Canvas: `#F6F7F4`
- Canvas Warm: `#FAFAF7`
- Paper: `#FFFFFF`
- Surface Soft: `#F0F2EF`
- Sage: `#EAF3ED`
- Soft Blue: `#EAF2F8`

## Text

- Ink: `#17211C`
- Secondary: `#4F5F56`
- Muted: `#768078`

## Brand

- Primary Green: `#245C46`
- Hover Green: `#1B4A38`
- Signal Lime: `#C1FF72`

## State

- Success: `#237A57`
- Warning: `#956800`
- Danger: `#B54747`
- Info: `#2F6F9F`

Rules:

- Deep green is the primary CTA.
- Lime is not a primary button fill.
- Lime is a small signal at key financial state changes.
- White/off-white dominate.
- No decorative neon glow.
- No black full-screen default sections.
- No crypto gradient system.

---

# Typography

Keep Hanken Grotesk.

Do not add another display font for this implementation.

Use JetBrains Mono only for:
- invoice IDs;
- payment references;
- receipt IDs;
- timestamps;
- selected demo-data labels.

Normal financial values should generally stay in Hanken with tabular numerals.

---

# Layout

The homepage must not be a stack of equal cards.

Use:

- large editorial headings;
- asymmetric text/product compositions;
- large readable product UI;
- one signature pinned story;
- open whitespace;
- paper/document layers;
- subtle background chapter changes.

Avoid:

- card grids as the main structure;
- bento-for-bento's-sake;
- generic abstract 3D;
- glass panels;
- tiny unreadable dashboards.

---

# Hero

Locked headline:

> **Turn every invoice into predictable cash.**

The invoice is the hero object.

Hero scene:
- invoice document foreground;
- editor/dashboard context behind;
- one matched/payment state as a supporting layer.

Do not place six unrelated mini-panels in the hero.

---

# Signature experience

The primary scroll-authored interaction is:

```text
CREATE
SHARE
PAY
VERIFY
MATCH
KNOW
```

Use one invoice through all six steps.

Desktop:
- GSAP ScrollTrigger;
- sticky/pinned product stage;
- narrative rail;
- transforms/opacity/clip-path.

Mobile:
- sequential vertical states;
- no long pin.

Reduced motion:
- sequential static/short-fade presentation.

---

# Motion technology

The marketing package already has GSAP.

Use:

- CSS for hover and simple transitions;
- GSAP for authored sequences;
- GSAP ScrollTrigger for the signature scroll section.

Do not add Motion/Framer Motion.

Do not add:
- Lenis;
- Three.js;
- WebGL;
- another animation library;
- cursor followers;
- magnetic buttons;
- 3D tilt.

---

# Homepage order

```text
Hero
Audience bridge
Invoice → Cash signature story
Invoicing
Payment outcomes / reconciliation
Receivables visibility
Customer payment
Trust & control
FAQ
Closing CTA
```

Header/footer live in root layout.

---

# Product-truth rule

Safe to show as shipped:
- T020 invoice editor;
- catalogue/ad-hoc lines;
- payment terms;
- customer reference;
- live preview;
- public invoice;
- Paystack payment;
- reconciliation;
- overpayment/review;
- refund workflow;
- receipts;
- dashboard;
- exports;
- audit;
- team/RBAC;
- payment setup.

Do not show as shipped:
- automatic reminders;
- recurring billing;
- collections queue;
- customer portal;
- promise to pay;
- disputes;
- forecasting;
- AI;
- NRS;
- multi-currency;
- ERP/accounting integrations.

---

# Reference rule

Do not browse randomly.

Use the mapped references in:

`docs/lumina-v2/10_MARKETING_REFERENCE_LIBRARY.md`

Primary:
- Tola;
- Acctual;
- Column;
- Stripe 2026;
- Lasso;
- PayFlexi Pinterest;
- Mobbin invoice flows;
- merged Lumina app.

Each reference has a specific assignment.

Synthesize.
Do not clone.

---

# Definition of quality

The result should feel:

- more welcoming than the old site;
- more original than a standard B2B SaaS template;
- more understandable than an abstract fintech concept site;
- more kinetic than the authenticated product;
- grounded in a real invoice-to-payment workflow.

If a visual effect makes the product harder to understand, remove it.
