---
name: Lumina Marketing v2
description: A light editorial-fintech expression of the Payment Trail for invoicing and receivables.
colors:
  canvas: "#F7F7F2"
  paper: "#FFFFFF"
  sage: "#E7EFE6"
  blue-soft: "#E9F1F7"
  ink: "#17211C"
  ink-muted: "#68746D"
  brand: "#275C46"
  signal: "#B7E56B"
  review: "#D89B3C"
  exception: "#C85D57"
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
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  product-surface:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "16px"
---

# Design System: Lumina Marketing v2

## Authority

The canonical marketing redesign brief is:

`docs/lumina-v2/05_MARKETING_SITE_REDESIGN.md`

Read that document before modifying the marketing homepage, motion system, visual tokens, product storytelling, or responsive choreography.

If this file conflicts with `05_MARKETING_SITE_REDESIGN.md`, the v2 redesign brief wins.

The previous dark graphite + neon-lime marketing world is **SUPERSEDED**.

---

## Creative North Star — The Payment Trail, Reframed

The Payment Trail remains the creative idea, but it is now expressed as a light, product-led receivables story.

The visitor should see an invoice move through:

```text
Create
→ Send
→ Collect
→ Pay
→ Reconcile
→ Know
```

The page should demonstrate that transformation while the visitor scrolls instead of presenting disconnected feature cards.

The site should feel:

- inviting;
- financially trustworthy;
- modern;
- editorial;
- product-specific;
- operational;
- suitable for both growing businesses and finance teams.

It should **not** feel like crypto software, developer infrastructure, or a neon fintech dashboard.

---

## Color System

Light surfaces dominate.

- **Canvas** (`#F7F7F2`): warm neutral page field.
- **Paper** (`#FFFFFF`): product/document surfaces.
- **Soft Sage** (`#E7EFE6`): section rhythm and calm finance tone.
- **Soft Blue** (`#E9F1F7`): secondary section field.
- **Ink** (`#17211C`): primary type.
- **Muted Ink** (`#68746D`): secondary type.
- **Brand Green** (`#275C46`): restrained financial brand color.
- **Action Lime** (`#B7E56B`): primary action and selective active-state emphasis.
- **Review Amber** (`#D89B3C`) and **Exception Coral** (`#C85D57`): semantic states.

Rules:

- Lime is an accent, not the environment.
- Avoid full-screen black/graphite sections unless there is a strong, exceptional narrative reason.
- Avoid decorative glow.
- Avoid crypto-style color gradients.
- Accessibility takes precedence over exact token values.

---

## Typography

Hanken Grotesk remains the default marketing family unless implementation testing proves another choice materially better.

Use:

- broad, confident editorial display type;
- dark ink on light backgrounds;
- readable business-facing body copy;
- JetBrains Mono only for references, timestamps, IDs, and specific product/demo data.

Do not make every financial value monospaced.

---

## Layout

The site should alternate between:

- generous text-led whitespace;
- large product compositions;
- pinned/sticky product demonstrations;
- quiet section transitions;
- denser operational UI sequences.

Avoid building the homepage as a uniform grid of equal rounded cards.

Product UI should be the primary visual proof.

---

## Motion

Motion is a signature part of the marketing experience.

Use it to explain how receivables state changes.

Preferred patterns:

- sticky product storytelling;
- one invoice/document continuing across multiple scroll beats;
- layered payment/reminder/receipt surfaces;
- scroll-linked state transitions;
- masked section-title reveals;
- restrained parallax;
- meaningful animated amounts/statuses;
- background transitions between canvas, paper, sage, and soft blue.

Avoid repeating generic fade-up animations on every section.

Implementation preference:

- **Motion** for normal in-view/micro interaction.
- **GSAP + ScrollTrigger** only for signature pinned/scrubbed sequences.
- CSS for simple transitions when sufficient.

All signature motion must have reduced-motion and mobile-specific alternatives.

---

## Product Surfaces

Marketing visuals should resemble real Lumina behavior.

Do:

- show invoice creation;
- show customer invoice/payment experience;
- show reminders/collection events;
- show reconciliation;
- show receipts;
- show receivables/dashboard state;
- use realistic demo data.

Do not:

- invent shipped functionality;
- fabricate customer proof or metrics;
- show impossible payment/reconciliation states;
- use generic fake dashboard art disconnected from Lumina.

---

## Homepage Story

The canonical order is defined in `05_MARKETING_SITE_REDESIGN.md`, with these major chapters:

1. Outcome-led hero.
2. Audience/credibility bridge.
3. Signature invoice-to-cash scroll sequence.
4. Collections.
5. Reconciliation.
6. Customer/payment experience.
7. Receivables visibility.
8. Trust/control.
9. Product ecosystem.
10. Closing CTA.

---

## References

Use Mobbin MCP and inspect the canonical references listed in `docs/lumina-v2/05_MARKETING_SITE_REDESIGN.md`.

Primary inspiration sources:

- Ramp — restraint and whitespace.
- Stripe — product confidence and storytelling.
- Monarch — approachable financial tone.
- Sequence — soft B2B finance presentation.

Synthesize; do not copy.

---

## Do / Don't

### Do

- Show real product behavior.
- Preserve the Payment Trail as one continuous narrative.
- Use light backgrounds and warm whitespace.
- Let product UI dominate illustrations.
- Make scroll progression communicate financial progression.
- Keep mobile intentional even when effects are simplified.
- Respect reduced-motion preferences.

### Don't

- Restore the old dark-first identity by default.
- Rebuild the homepage from identical feature cards.
- Use fake logos, metrics, awards, certification, or customer proof.
- Use lime on every border/control.
- Put animation ahead of content comprehension.
- shrink desktop pinned choreography directly onto mobile.
