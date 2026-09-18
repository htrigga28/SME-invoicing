# Lumina Marketing Evolution — Visual QA Scorecard

**Status:** REQUIRED ACCEPTANCE CHECKLIST  
**Scope:** `apps/marketing`  
**Use with:** `05_MARKETING_SITE_REDESIGN.md`, `10_MARKETING_REFERENCE_LIBRARY.md`, `11_CURRENT_MARKETING_UI_AUDIT.md`, `12_MARKETING_REDESIGN_CODEX_PROMPT.md`

The marketing redesign is not complete when the code compiles. It is complete when the browser result passes this scorecard.

Do not treat this as a subjective "looks good" review.

---

# 1. Global pass/fail gates

All must pass.

- [ ] Marketing root is light by default.
- [ ] No `color-scheme: dark` remains in marketing root styling.
- [ ] No full-screen black/near-black homepage section remains.
- [ ] Deep green is the primary action color.
- [ ] Lime is only a small signal/accent.
- [ ] Hanken Grotesk remains the main family.
- [ ] No new display font was introduced.
- [ ] No new animation library was introduced.
- [ ] No 3D/WebGL/Three.js was introduced.
- [ ] Old hero orbit treatment is gone.
- [ ] Old multi-panel dark Payment Trail hero is gone.
- [ ] Old central trust topology is gone.
- [ ] Old full-lime signup section is gone.
- [ ] Header is light.
- [ ] Footer is light.
- [ ] Privacy/Terms are light.
- [ ] Product visuals clearly resemble the merged Lumina app.
- [ ] No unshipped T021+ feature is shown as live.
- [ ] Reduced-motion mode preserves all content.
- [ ] Mobile does not use the desktop long pinned choreography.

Any failure above blocks completion.

---

# 2. Visual constants

These are target ranges, not reasons to break responsive layout.

## Width

- Main content max width: approximately 1200–1320px.
- Narrative text measure: approximately 520–680px.
- Hero copy measure: approximately 620–760px.
- Long body-copy line length: avoid > 75–80 characters where practical.

## Section spacing

Desktop:
- major chapter vertical spacing: approximately 112–168px.

Tablet:
- approximately 88–128px.

Mobile:
- approximately 72–104px.

Do not use identical section padding everywhere.

## Radii

- standard product surface: approximately 12–18px;
- document/paper: approximately 4–10px;
- buttons/controls: approximately 8–12px;
- pills only where semantics call for a pill.

Do not turn every container into a 24–32px rounded blob.

## Borders/shadows

- borders should be quiet and common;
- shadows should be rare;
- strongest shadows reserved for floating document/product layers;
- no glow.

---

# 3. Header QA

Desktop target:
- height approximately 64–76px;
- logo visually stable;
- Product / How it works / Trust / FAQ readable;
- Sign in secondary;
- Create account primary.

Pass:

- [ ] header does not look like a dark floating capsule;
- [ ] header does not dominate first viewport;
- [ ] scroll state adds subtle separation, not a dramatic transformation;
- [ ] Product menu stays within viewport;
- [ ] Product menu links match real sections;
- [ ] keyboard focus visible;
- [ ] Escape closes menus;
- [ ] outside click closes Product menu;
- [ ] mobile menu scroll locks correctly;
- [ ] mobile menu is readable at 390px.

---

# 4. Hero QA

At 1440px:

- [ ] headline is the strongest element;
- [ ] H1 reads in approximately 2–3 lines, not 5+;
- [ ] supporting copy is readable without spanning full page width;
- [ ] invoice/product scene is visible above the fold;
- [ ] invoice is the dominant product object;
- [ ] no more than ~3 major visual layers compete at once;
- [ ] CTA pair is obvious;
- [ ] no fake logos/metrics/social proof;
- [ ] there is enough negative space around headline.

At 390px:

- [ ] headline fits without awkward word breaks;
- [ ] CTA stack remains visible;
- [ ] product visual is readable;
- [ ] product visual does not require horizontal scrolling;
- [ ] no tiny dashboard copy.

Motion:

- [ ] hero entrance completes in about 1.2s or less;
- [ ] no infinite floating loop;
- [ ] no large blur;
- [ ] reduced motion shows final state immediately.

---

# 5. Audience bridge QA

- [ ] section is brief;
- [ ] does not become a fake logo wall;
- [ ] three audience groups are readable;
- [ ] does not consume more visual weight than the signature story.

---

# 6. Signature Invoice → Cash QA

This is the highest-priority experience.

Desktop:

- [ ] section has exactly six narrative beats: Create / Share / Pay / Verify / Match / Know;
- [ ] same invoice number persists through all six;
- [ ] same business/customer persists;
- [ ] same total persists;
- [ ] stage is large enough to read;
- [ ] pinned stage begins after section intro;
- [ ] pinned stage releases before next section;
- [ ] no sudden jump when pin starts;
- [ ] no sudden jump when pin ends;
- [ ] scroll direction feels natural;
- [ ] copy and visual state change at roughly the same point;
- [ ] only one primary state is visually dominant at a time;
- [ ] invoice remains recognizable through transitions;
- [ ] payment reference appears only after Pay/Verify;
- [ ] receipt appears only after financial confirmation;
- [ ] final state visibly shows `₦0 due` or paid state.

Implementation:

- [ ] uses ScrollTrigger rather than manual per-frame React state;
- [ ] ScrollTrigger cleaned up on unmount;
- [ ] resize/refresh does not duplicate triggers;
- [ ] console has no GSAP warnings;
- [ ] animation uses transform/opacity/clip primarily;
- [ ] no long blur animation;
- [ ] no bouncing/elastic effects.

Mobile:

- [ ] no long pin;
- [ ] six steps render vertically;
- [ ] each state is readable;
- [ ] visual continuity survives without animation;
- [ ] page remains easy to flick-scroll.

Reduced motion:

- [ ] no pin;
- [ ] no scrub;
- [ ] all six states/content accessible.

---

# 7. Invoicing chapter QA

Reference target:
merged Lumina T020 + Acctual + Stripe/Mercury Mobbin.

Pass:

- [ ] editor and document preview relationship is obvious;
- [ ] preview looks like an invoice, not a summary card;
- [ ] catalogue is represented accurately;
- [ ] payment terms are represented accurately;
- [ ] customer reference/PO is represented accurately;
- [ ] no recurring/reminder feature appears;
- [ ] document text is readable at 1280px;
- [ ] mobile composition crops/simplifies rather than shrinking everything.

Motion:
- [ ] one cause/effect moment is enough;
- [ ] line-item/preview update is clear;
- [ ] animation does not imply unsupported autosave/backend behavior.

---

# 8. Reconciliation explorer QA

- [ ] three states only: Matched / Needs review / Refund confirmed;
- [ ] selected state has non-color indicator;
- [ ] keyboard arrows work;
- [ ] amount/reference/invoice/next action readable;
- [ ] transitions <= ~220ms;
- [ ] no blur;
- [ ] no fake AI recommendation;
- [ ] overpayment/refund copy matches actual current behavior.

---

# 9. Receivables visibility QA

- [ ] one main operational surface, not four equal feature cards;
- [ ] Outstanding visible;
- [ ] Overdue visible;
- [ ] Net collected visible;
- [ ] Needs attention visible;
- [ ] recent meaningful activity visible;
- [ ] numbers use tabular alignment;
- [ ] chart, if present, explains real implemented data;
- [ ] no cash forecast;
- [ ] no DSO/CEI unless current app/API actually provides it;
- [ ] no fake trend percentages.

Motion:
- [ ] data animates once only;
- [ ] values do not continuously tick;
- [ ] chart movement does not obscure labels.

---

# 10. Customer payment QA

- [ ] merchant/business identity is clear;
- [ ] invoice number visible;
- [ ] amount due is obvious;
- [ ] due date readable;
- [ ] pay CTA is obvious;
- [ ] copy does not imply Lumina holds funds;
- [ ] no customer-account/portal UI;
- [ ] confirmation state looks related to the public invoice;
- [ ] visual feels calmer than internal app UI.

---

# 11. Trust & control QA

- [ ] headline is business-facing;
- [ ] no network/topology diagram;
- [ ] no fake certifications;
- [ ] no fake encryption claims;
- [ ] Paystack boundary is clear;
- [ ] no-secret-key claim is accurate;
- [ ] masked payout claim is accurate;
- [ ] RBAC/audit claim is accurate;
- [ ] section does not become dense technical documentation.

---

# 12. FAQ QA

- [ ] details/summary remain keyboard accessible;
- [ ] questions reflect current product;
- [ ] answers do not promise future features;
- [ ] separators readable;
- [ ] open answer line length is comfortable.

---

# 13. Closing CTA QA

- [ ] one full-width deep-green field;
- [ ] no full-lime background;
- [ ] headline and CTA have strong contrast;
- [ ] Create account is primary;
- [ ] Sign in is secondary;
- [ ] no giant onboarding diagram competing with CTA;
- [ ] mobile CTA visible without awkward overflow.

---

# 14. Footer QA

- [ ] light/warm background;
- [ ] compact;
- [ ] product anchors valid;
- [ ] privacy/terms valid;
- [ ] sign-in valid;
- [ ] no duplicate oversized CTA;
- [ ] copyright year correct.

---

# 15. Legal-page QA

Privacy and Terms:

- [ ] light canvas;
- [ ] no old orbit decoration;
- [ ] readable content width;
- [ ] sticky aside does not break mobile;
- [ ] green links;
- [ ] same header/footer;
- [ ] no dark-theme remnants.

---

# 16. Responsive screenshot matrix

Required screenshots:

## 1440
- [ ] hero
- [ ] Create stage
- [ ] Pay stage
- [ ] Match/Know stage
- [ ] invoicing
- [ ] visibility
- [ ] customer payment
- [ ] trust
- [ ] closing CTA

## 1280
- [ ] full homepage long screenshot or representative sequence
- [ ] signature pin start/end behavior

## 768
- [ ] hero
- [ ] signature behavior
- [ ] invoicing
- [ ] customer payment

## 390
- [ ] hero
- [ ] all six signature steps in sequence
- [ ] invoicing
- [ ] reconciliation tabs
- [ ] visibility
- [ ] public payment
- [ ] closing CTA
- [ ] mobile nav

## Reduced motion
- [ ] signature section
- [ ] hero
- [ ] one interactive section

---

# 17. Reference-comparison checklist

After first implementation pass, compare screenshots against these assignments.

## Tola

Check:
- [ ] finance feels approachable;
- [ ] whitespace is confident;
- [ ] copy is readable.

## Acctual

Check:
- [ ] invoicing feels creatively presented;
- [ ] document is visually central;
- [ ] page avoids generic feature-card structure.

## Column

Check:
- [ ] light finance presentation feels premium;
- [ ] large sections have breathing room.

## Stripe / Lasso

Check:
- [ ] product story has continuity;
- [ ] scroll pacing is intentional;
- [ ] product proof arrives early.

## PayFlexi / Fincore Pinterest

Check:
- [ ] motion feels native to a SaaS product;
- [ ] finance UI remains readable while moving.

## Merged Lumina app

Check:
- [ ] marketing product UI is recognizably Lumina;
- [ ] colors and document styling are related;
- [ ] marketing does not invent a new product.

Do not compare pixel-for-pixel.

---

# 18. Anti-tangent checklist

Before accepting any new design idea during implementation, ask:

1. Does it help explain invoicing, payment, reconciliation, or financial visibility?
2. Is it supported by shipped product behavior?
3. Is it assigned by one of the approved references?
4. Can it be implemented without adding a new major dependency?
5. Does it improve the 390px experience too?

If the answer is "no" to two or more, do not add it.

Examples to reject automatically:

- 3D coin;
- floating credit card;
- abstract orb;
- cursor-following spotlight;
- WebGL particles;
- finance-themed stock photography;
- fake testimonial carousel;
- logo marquee without customers;
- pricing table without pricing;
- AI assistant mockup;
- customer portal mockup before customer portal exists;
- animated world map;
- generic KPI bento grid;
- smooth-scroll hijacking.

---

# 19. Final technical gates

- [ ] marketing lint passes;
- [ ] marketing typecheck passes;
- [ ] marketing tests pass;
- [ ] marketing build passes;
- [ ] full repo lint/typecheck/tests/build pass where practical;
- [ ] no console errors;
- [ ] no hydration warnings;
- [ ] no duplicated ScrollTriggers;
- [ ] no horizontal page overflow at required widths;
- [ ] no focus trap regression;
- [ ] no broken anchor IDs;
- [ ] no broken signup/sign-in URLs;
- [ ] no SEO/JSON-LD regression.

Only then is MKT-01 ready for review.
