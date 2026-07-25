---
name: Lumina Marketing
description: The Payment Trail — a product-led conversion system for invoice payment clarity.
colors:
  night: "#070a08"
  graphite: "#0d110e"
  ledger: "#121813"
  raised: "#182019"
  ink: "#f5f7ef"
  ink-muted: "#aeb8a7"
  signal: "#c1ff72"
  signal-deep: "#91d63f"
  verified: "#72e6b1"
  review: "#f6c96b"
  exception: "#ff7878"
typography:
  display:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(3.25rem, 8vw, 6rem)"
    fontWeight: 620
    lineHeight: 0.94
    letterSpacing: "-0.035em"
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
  scale:
    micro: "0.625rem"
    microWide: "0.65rem"
    dataSmall: "0.6875rem"
    data: "0.75rem"
    caption: "0.8125rem"
    label: "0.875rem"
    action: "0.9375rem"
    body: "1rem"
    bodyFluidMin: "1.05rem"
    bodyLarge: "1.0625rem"
    subheadSmall: "1.1rem"
    subhead: "1.125rem"
    subheadWide: "1.15rem"
    leadSmall: "1.2rem"
    lead: "1.25rem"
    panelHeading: "1.35rem"
    headingSmall: "1.5rem"
    money: "1.65rem"
    displayXs: "2.25rem"
    displaySm: "2.5rem"
    displayMobile: "2.75rem"
    displayBase: "3rem"
    displayHero: "3.25rem"
    displayMobileMax: "3.8rem"
    displayFooter: "4rem"
    displayMoney: "4.25rem"
    displaySection: "4.5rem"
    displayMobileHero: "4.7rem"
    displayPosition: "4.75rem"
    displayLegal: "5.5rem"
    displayMax: "6rem"
rounded:
  compact: "9px"
  navigation: "10px"
  control: "12px"
  floating: "14px"
  surface: "16px"
  pill: "999px"
spacing:
  compact: "8px"
  control: "12px"
  section: "clamp(88px, 11vw, 168px)"
components:
  button-primary:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.night}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  product-surface:
    backgroundColor: "{colors.ledger}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "16px"
---

# Design System: Lumina Marketing

## Overview

**Creative North Star: “The Payment Trail”**

Lumina’s marketing surface behaves like a financial trail coming into focus. Invoice, checkout, provider confirmation, reconciliation, settlement, and receipt are composed as one continuous system rather than isolated feature cards. The visitor should remember the connected trail and the moment ambiguity becomes a clear next action.

The world is dark because owners often check operations between tasks and need high signal with low glare. Lime acts like a verified marker on a ledger; amber and red appear only when financial state requires attention. Layouts are asymmetrical and molded around real product content, with deliberate quiet between dense demonstrations.

**Key Characteristics:** connected, product-specific, restrained, operational, owner-readable.

## Colors

Graphite neutrals carry the page. Signal colors belong to financial meaning, not decoration.

- **Night** (`#070a08`): page background.
- **Graphite** (`#0d110e`): navigation and quiet fields.
- **Ledger** (`#121813`): authored product demonstrations.
- **Raised** (`#182019`): selected and interactive product states.
- **Ink** (`#f5f7ef`): primary text.
- **Muted Ink** (`#aeb8a7`): supporting text; never use it below accessible contrast.
- **Signal Lime** (`#c1ff72`): primary action, active trail, and verified emphasis.
- **Verified Mint** (`#72e6b1`), **Review Amber** (`#f6c96b`), **Exception Coral** (`#ff7878`): semantic states only.

**The Signal Rule.** Lime marks the primary action or the current truth; it does not outline every container.

## Typography

- **Display Font:** Hanken Grotesk
- **Body Font:** Hanken Grotesk
- **Data Font:** JetBrains Mono

Display type is broad, compact, and owner-facing. Supporting copy is loose enough to read quickly. Mono is reserved for real references, amounts, code, and status metadata.

- **Display:** 620 weight, `clamp(3.25rem, 8vw, 6rem)`, 0.94 line height, -0.035em tracking.
- **Section heading:** 580–620 weight, `clamp(2.25rem, 5vw, 4.5rem)`, balanced line wraps.
- **Body:** 450 weight, 1–1.125rem, 1.65–1.75 line height, maximum 68ch.
- **Data:** 600 weight, 0.6875–0.8125rem, tabular numerals.

## Layout

The desktop canvas is a 12-column field capped near 1240px. Product visuals may cross columns and overlap their connector path, but reading order remains linear in the DOM. Dense product passages alternate with quiet, left- or center-aligned statements. Section rhythm is `clamp(88px, 11vw, 168px)`.

At tablet sizes, overlaps become contained two-column compositions. Below 768px, the trail becomes a vertical sequence, product panels stack, menu hover behavior becomes an accordion, and motion reduces to opacity and short translation.

## Elevation & Depth

Depth comes from tonal layers, clipped edges, and occasional offset ambient shadows. Wide colored halos are not a component treatment. Blur is reserved for the outcome transition and navigation backdrop where it communicates state change or depth.

## Shapes

Controls use 12px corners; authored product surfaces use 16px. Small status chips may be pills. Large sections are shaped by connector paths, cropped panels, and asymmetric edges rather than wrapping every passage in a rounded card.

## Components

### Buttons

Primary buttons are lime with dark text and a compact 12px radius. Hover shifts the surface deeper and lifts by no more than 2px. Focus uses a high-contrast two-layer ring. Secondary actions are textual or dark filled controls, not duplicate outlined CTAs.

### Product Surfaces

Product surfaces use ledger and raised tones, one structural border or one shadow, never both. Their content must resemble a real invoice, payment event, receipt, or operational view and carry a visible “Demo data” label when synthetic.

### Navigation

The desktop header is compact and floating. The Product menu keeps one fixed shell open while its active preview shifts between product stories. Mobile uses a full-width drawer and accordion; no information depends on hover.

### Inputs

Inputs use raised graphite, clear labels, 12px corners, and a lime focus ring. Optional fields remain discoverable through a semantic disclosure. Error text names the recovery action.

## Do's and Don'ts

### Do:

- **Do** show a continuous payment trail and realistic product states.
- **Do** vary density, alignment, and scale while keeping one visual grammar.
- **Do** keep critical state visible in text and support reduced motion.
- **Do** preserve accurate Paystack, custody, refund, and currency boundaries.

### Don't:

- **Don't** rebuild the page as equal icon-heading-copy cards.
- **Don't** use fake customer proof, metrics, certification, or availability claims.
- **Don't** repeat the same eyebrow, checklist, workflow box, or entrance animation in every section.
- **Don't** use lime as a decorative border around every surface.
