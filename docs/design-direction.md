# Design Direction

## Product Feel

The authenticated product is a light, calm, precise financial workspace (Clear Financial Workspace):

- Light by default
- Financially trustworthy
- Calm, not flashy
- High information clarity
- SME-approachable, finance-team-deep
- Strong tables and workflow views
- Restrained brand color (deep green actions, lime only as rare highlight)
- Minimal decorative chrome
- Explicit status and exception handling
- Responsive and mobile-capable
- Motion only to clarify interaction

Avoid:

- Dark fintech command-center styling (superseded T017 direction below).
- Decorative landing-page-style UI.
- Excessive gradients, glow effects, pill-everything.
- Fake mockup screens.
- Overly equal-weight card grids that hide hierarchy.
- Giant filter forms above every list.
- Permanent row-action button clusters.
- Mono-everything money (mono is for references/IDs; money is Hanken + tabular).
- Building visual polish before workflow correctness.

Every primary workflow must be demoable in under 5 minutes.

## Visual Identity (authoritative for `apps/web`)

Per `docs/lumina-v2/06_APP_DESIGN_OVERHAUL.md`: off-white canvas (#F6F7F4), white working surfaces, neutral borders, deep-green (#245C46) primary actions, lime (#C1FF72) demoted to rare highlight, independent success/warning/danger/info tokens, restrained shadows (overlays only), Hanken Grotesk + tabular numerals, JetBrains Mono for references.

Superseded: the T017 dark visual direction (near-black canvas, neon-lime primary, dark utility remapper) is no longer authoritative for visuals. Its domain/accessibility/workflow guidance still applies where compatible with the light system.

Hanken Grotesk is the interface font. JetBrains Mono is reserved for invoice/receipt numbers, payment references, and technical identifiers.

## Layout Principles

- Quiet shell: white sidebar + light utility topbar; page titles live in content, not duplicated in chrome.
- Standard header: Title + short operational description + one primary action (secondaries in `…`).
- One dominant working surface per page (table, document, editor+preview); side rails/drawers/timelines support it.
- Tables as working surfaces: quiet headers, 44–52px rows, right-aligned money, whole-row nav, overflow menus, mobile record cards.
- Compact data toolbars (search + status tabs + filters + Clear) instead of card-like filter forms.
- Public invoice/receipt as premium customer documents (merchant-led, amount/due first, clear Pay CTA), not admin chrome.
- Consistent status colors + text labels for invoice and payment states; never color-only.
- Prefer clear empty/loading/error states over decorative filler.

## Screen Guidance

| Screen | Guidance |
| --- | --- |
| Overview | Header + compact period control + New invoice; 4 metrics max (Outstanding, Overdue, Net collected, Needs attention); large Collections cashflow + Needs Attention side; Aging + unified Recent activity; payment setup as contextual banner. No equal-card sprawl, no status donut unless actionable. |
| Customers list/detail | Compact Active/Archived tabs + search toolbar; row nav + overflow (View/Edit/Archive); detail = identity header + Invoiced/Paid/Balance/Invoices strip + invoice history as main surface + compact contact rail. No invented AR metrics, no empty future tabs. |
| Invoice list | Status tabs (All/Draft/Sent/Overdue/Paid) + compact search/filter toolbar; table Invoice/Customer/Due/Total/Balance/Status + `…`; whole-row nav; mobile record rows; real pagination/filters preserved. |
| Invoice creation | 48/52 editor + true customer-facing `InvoiceDocument` preview on desktop (same model as public page); grouped sections; compact line-item table (not bordered cards) with icon remove; sticky Save draft / Save and send hierarchy (server totals authoritative); tablet toggle + mobile full-screen preview sheet. Catalogue picker + ad-hoc + quick-create plug into the same line pattern. |
| Invoice detail | Header (number/status/customer/balance/due + one primary + overflow); left document + payments; right Activity timeline + financial Summary + Customer payment panel. Edit/Send/Cancel/Void/Duplicate gated by role/status; reconciliation truth explicit. |
| Products & Services | Searchable catalogue with Active/Archived views, create/edit/archive/restore, Viewer read-only parity; compact toolbar + table grammar shared with other lists. |
| Public invoice payment page | Warm canvas; merchant identity; amount due + due/status immediately readable; clean document; deep-green Pay CTA (mobile visible early); Paystack redirect/support understated; Lumina secondary; all payment/verify/poll/view-tracking behavior unchanged. |
| Public receipt | Same customer-document shell as public invoice; receipt/refund/payment-reference truth explicit; print preserved. |
| Payments/reconciliation page | Compact stat strip (not 4 large cards); preserve Reconciliation/All/Needs-review segmentation; compact toolbar; dominant table (Reference/Customer/Invoice/Amount/Payment/Reconciliation/Date + `…`); Needs Review elevates reason + next action; settlement/reconciliation distinctions preserved; no shell leakage of internal states. |
| Receipts page | Same list grammar as Invoices/Payments; Receipt/Customer/Invoice/Amount/Refund/Issued + `…`; payment reference secondary on narrow screens. |
| Exports | Calm task-selection cards (dataset + description + compact filters + export + permission state); not forced into a table. |
| Audit logs | Dense full-width table + compact toolbar + detail drawer for metadata; no decorative treatment. |
| Team / Payment setup / Settings | Coherent settings column (secondary nav in content, 840–1000px content, flat section cards); Team = compact invite + member table + pending separated + confirmations; Payment setup = high-trust setup flow (status summary, bank/account fields, resolved confirmation, verification/disabled states). |
| Auth / onboarding / invite | Centered intentional light cards; calm 3-step Account → Business → Payments progress; same visual grammar for payment-setup onboarding and invite acceptance; real gating/validation/redirects unchanged. |
