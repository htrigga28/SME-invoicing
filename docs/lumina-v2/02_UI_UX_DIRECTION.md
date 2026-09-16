# Lumina v2 — UI / UX Direction

**Status:** APPROVED FOR IMPLEMENTATION  
**Purpose:** Give Codex concrete visual and interaction direction without requiring a separate design phase.

## 1. Core UX Principle

Lumina should feel like a **receivables workspace**, not a collection of admin CRUD pages.

Every primary screen should answer one or both of these questions:

1. **What happened?**
2. **What should I do next?**

The interface should prioritize financial truth, workflow state, exceptions, and next actions over decorative UI.

---

## 2. Product vs Marketing Visual Language

The current dark graphite + signal-lime identity is strong for the marketing site and portfolio presentation.

For the product application, move toward a more workday-oriented finance UI:

### Product workspace direction

- Prefer a **light or very light neutral default workspace** for high-density finance workflows.
- Keep Lumina’s lime/green as a controlled brand/action accent.
- Use dark text, subtle neutral surfaces, restrained borders and high legibility.
- Preserve semantic amber/red/green states.
- Dark mode may remain available or may be implemented later, but **dark-only should no longer be treated as mandatory product identity**.
- Avoid excessive rounded cards and glow effects.
- Tables, ledgers, split views, drawers and timelines should dominate where appropriate.

### Marketing direction

Keep the existing “Payment Trail” story and dark, expressive brand system unless a future marketing-specific redesign says otherwise.

---

## 3. Reference Products and What to Borrow

Codex has access to Mobbin MCP. Use these references actively during implementation.

### Stripe — invoice authoring and preview

Mobbin flow:
https://mobbin.com/flows/03c71446-31eb-497b-b715-3419cf8cd922

Borrow:

- Split invoice editor + live preview.
- Clear grouping of customer, currency, items, collection, delivery and branding options.
- Progressive detail without visual clutter.
- Hosted invoice/payment page polish.

Do not copy branding or page structure literally.

### Mercury — calm finance hierarchy and guided invoicing

Mobbin invoicing screen:
https://mobbin.com/screens/2cc902ac-0a58-4fa2-87ff-1738b99aab56

Mobbin flow:
https://mobbin.com/flows/ef4623ce-bc68-4006-9c98-f720a4546769

Borrow:

- Calm, restrained financial workspace.
- Strong whitespace without losing information density.
- Progressive invoice creation.
- Simple KPI treatment.
- Secondary details revealed only when needed.

### Midday — compact invoice index

Mobbin:
https://mobbin.com/screens/f2a4a414-3111-4357-a01c-0cb2933ecb92

Borrow:

- Compact invoice list.
- Highly readable status and amount treatment.
- Strong table/list hierarchy.
- Useful row actions.

### Xero — receivables overview and practical reporting

Mobbin:
https://mobbin.com/screens/7e99b13f-3003-4846-98b4-0e9f939f4969

Borrow:

- Receivables-focused summary states.
- Statements/accounts orientation.
- Operational reporting patterns.

### Stripe finance dashboard

Mobbin:
https://mobbin.com/screens/54ef3db8-2b9e-4ef3-a91a-cad15de1e1c9

Borrow:

- Dense but readable operational data.
- Minimal visual ornament around metrics.
- Status segmentation.

### Airwallex invoice creation

Mobbin flow:
https://mobbin.com/flows/45967791-df7e-43f8-954a-4c45b5e30e20

Borrow:

- Structured invoice sections.
- Business/customer separation.
- Due-date and payment configuration.
- Professional document detail layout.

### QuickBooks

Mobbin flow:
https://mobbin.com/flows/fed2ecc7-405f-49ad-a70b-efafc3d49a5a

Borrow selectively:

- Rich invoice configuration.
- Useful invoice actions.
- Customization options.

Avoid:

- The older visual density and complexity.
- Excessive side-panel configuration exposed all at once.

---

## 4. Information Architecture

Target navigation should gradually move toward:

```text
Overview

RECEIVABLES
  Invoices
  Customers
  Collections
  Payments
  Reconciliation

SALES
  Quotes            [when built]
  Recurring billing [when built]
  Products & Services

INSIGHTS
  Receivables
  Cash forecast     [later]
  Reports

AUTOMATION
  Workflows         [when built]
  Templates

Settings
  Business
  Payment setup
  Team
  Integrations      [later]
  Audit logs
```

Do not expose empty navigation just to match this future IA. Add modules as they become real.

---

## 5. Global Interaction Patterns

### Split-view for operational lists

For Invoices, Collections, Payments/Reconciliation and eventually Disputes, prefer a list/table with an optional detail side panel or master-detail pattern where this improves speed.

Do not force users to navigate to a new full page for every inspection if a side detail can safely provide the necessary context.

### Drawers over excess modals

Use drawers for:

- quick customer detail;
- promise-to-pay creation;
- reminder/send actions;
- payment/reconciliation inspection;
- activity context.

Use modals for focused confirmation or destructive action only.

### Command palette

Add a keyboard-accessible command palette when it fits the shell refactor:

- Create invoice.
- Create customer.
- Find invoice.
- Open customer.
- Open collections.
- Record/log action later.

Do not prioritize the palette over T020 core invoice UX if time is limited.

### Search

Global and route-level search should prioritize financial identifiers and customer names:

- invoice number;
- customer;
- email;
- payment reference;
- receipt number.

### Filters

Filters should be compact and saved in URL/query state where practical.

Avoid giant filter forms at the top of every page.

---

## 6. Dashboard / Overview

The dashboard should evolve from generic KPI reporting into a receivables command center.

### Top metrics

Prefer a concise strip such as:

- Outstanding.
- Overdue.
- Collected this period.
- Expected next 30 days [when supported].
- DSO [when supported].
- Needs attention.

### Supporting modules

- Aging breakdown.
- Expected cash / collections chart later.
- Accounts needing attention.
- Recent meaningful activity.
- Payment/reconciliation exceptions.
- Recurring billing state when built.

### Rule

Do not create charts just because data exists. If a table or ranked list produces a clearer next action, use it.

---

## 7. Invoice List

Target hierarchy:

```text
Invoices                                           + New invoice

[All] [Open] [Overdue] [Paid] [Draft]
Search…                      Filters     Export

NUMBER     CUSTOMER     DUE        BALANCE      STATUS     ACTIVITY/ACTION
INV-1042   Acme Ltd     12d ago    ₦850,000     Overdue    Viewed 5d ago
INV-1043   DamiCo       Sep 21     ₦450,000     Sent       Not viewed
```

Useful row data:

- number;
- customer;
- issue/due date;
- total;
- paid;
- balance;
- status;
- optionally latest relevant activity.

Row actions:

- view;
- duplicate;
- send/resend;
- copy public link where appropriate;
- cancel/void based on status.

Avoid displaying every possible action permanently.

---

## 8. Invoice Creation — Flagship Screen

This is a flagship Lumina v2 surface.

### Desktop

Use two major regions:

```text
┌──────────────────────────────────────┬──────────────────────────────┐
│ EDITOR                               │ LIVE INVOICE PREVIEW         │
│                                      │                              │
│ Customer                             │ Business logo/name           │
│ Invoice metadata                     │ Invoice number               │
│ Items                                │ Bill to                      │
│ Tax/discount                         │ Line items                   │
│ Terms / due date                     │ Totals                       │
│ Memo                                 │ Terms/memo                   │
│ Delivery                             │                              │
│                                      │ Customer-visible only        │
│ [Save draft] [Preview] [Send]        │                              │
└──────────────────────────────────────┴──────────────────────────────┘
```

### UX rules

- Preview updates as data changes.
- New catalog item can be created inline or through a focused drawer.
- Do not show configuration irrelevant to the current invoice.
- Totals remain authoritative from server/business logic; the preview may calculate optimistically for UX but must reconcile to server response.
- Customer-facing vs internal fields must be visually explicit.
- Autosave must never produce confusing sent/financial state.

### Mobile

- Single-column form.
- Sticky bottom actions if appropriate.
- Dedicated Preview action opens full-screen preview/drawer.
- Line item editing optimized for touch.

---

## 9. Invoice Detail — “The Payment Trail” in Product Form

The invoice detail page should embody Lumina’s brand thesis.

### Header

- Invoice number.
- Customer.
- Status.
- Balance due.
- Due date / days overdue.
- Primary contextual action.

### Main content

Use a layout with:

- invoice document/details;
- payment summary;
- activity timeline;
- customer context;
- available actions.

### Activity timeline

Example:

```text
Sep 12 09:42  Invoice created
Sep 12 10:03  Sent to jane@acme.com
Sep 12 10:46  Viewed by customer
Sep 15 08:00  Reminder sent
Sep 18 14:12  Promise to pay added     [later]
Sep 20 11:07  Payment confirmed
Sep 20 11:07  Automatically reconciled
Sep 20 11:08  Receipt issued
```

Use icons sparingly. Time, actor/channel and event meaning should be readable as text.

---

## 10. Customer 360

Customer pages should stop feeling like CRUD detail pages.

### Header

```text
Acme Nigeria Ltd

Outstanding      Overdue      Avg days to pay      Last payment
₦5.48m           ₦1.22m       24 days              Sep 14
```

### Tabs

- Overview.
- Invoices.
- Payments.
- Statements.
- Activity.
- Contacts.
- Later: Disputes / Promises.

### Overview content

- Receivables summary.
- Aging.
- Latest invoices.
- Latest payment.
- Communication/collection state.
- Account owner/collector later.

The page should explain the commercial relationship at a glance.

---

## 11. Collections Workspace — Flagship Screen

This screen is about work prioritization.

### Top

- Total overdue.
- Amount due this week.
- Accounts needing action.
- Broken promises [once available].

### Primary list

```text
CUSTOMER     OUTSTANDING   OVERDUE   OLDEST    LAST CONTACT   PROMISE       NEXT ACTION
Acme Ltd     ₦4.2m         ₦3.1m     34d       5d ago         Sep 18        Call
DamiCo       ₦880k         ₦880k     11d       Yesterday      —             Reminder
Skyworks     ₦620k         ₦120k     4d        Today          —             Wait
```

### Side detail

Selecting a customer should show:

- aging/open invoices;
- recent timeline;
- contacts;
- promise state;
- internal notes;
- send reminder / log contact / create promise actions.

### Visual rule

Do not use a card grid for collection accounts. Use a high-quality operational list/table.

---

## 12. Payments / Reconciliation

The existing implementation already has strong business logic. Improve the UI without collapsing distinct concepts.

Keep clear separation between:

- payment attempt/provider status;
- successful payment truth;
- invoice application;
- reconciliation state;
- review/exception state;
- refund state.

A finance user should be able to answer:

- Did money actually arrive?
- What invoice/customer was it applied to?
- Is there an exception?
- What action is required?
- Was excess money refunded?

Use master-detail or detail drawer patterns where useful.

---

## 13. Public Invoice / Customer Payment Experience

This should be treated like a premium customer checkout/document experience.

### Priorities

1. Business identity.
2. Amount due.
3. Due date/status.
4. What the customer is paying for.
5. Clear payment action.
6. Alternative payment method information.
7. Trust/support information.

### Avoid

- Internal admin metadata.
- Excessive dark UI if it weakens document readability.
- Dashboard chrome.
- Dense internal status vocabulary.

### Mobile

Mobile is extremely important because customers may open invoice links from WhatsApp or email.

The payment CTA and amount due must be immediately visible and comfortable to use.

---

## 14. Customer Portal

The portal should feel like a lightweight B2B account center, not the internal app exposed externally.

Core navigation:

- Overview.
- Invoices.
- Payments/receipts.
- Statements.

Overview:

- amount outstanding;
- overdue amount;
- next due invoice;
- recent payments;
- obvious Pay outstanding action.

Keep branding primarily on the merchant/business; Lumina can be secondary infrastructure branding.

---

## 15. Typography and Data

The current Hanken Grotesk + JetBrains Mono pairing may be retained if it works in the lighter product UI.

Rules:

- Use tabular numerals for financial columns.
- Use monospaced text sparingly for references/IDs, not every number.
- Major money values should be highly legible without being giant marketing-style typography.
- Keep table row height compact but touch-friendly where relevant.

---

## 16. Color / Status

Brand accent should not be overloaded with semantic meaning.

Suggested model:

- Accent/lime/green: primary actions, active brand emphasis.
- Success: paid/matched/fulfilled.
- Warning: pending/partial/review.
- Danger: overdue/failed/broken promise.
- Neutral: draft/sent/viewed/void/cancelled as appropriate.

Never rely on color alone.

---

## 17. Responsive Direction

### Desktop

- Tables and split views.
- Live preview in invoice authoring.
- Persistent sidebar/navigation.
- Dense information when useful.

### Tablet

- Reduce columns.
- Detail may become drawer.
- Preview may become toggleable panel.

### Mobile

- No desktop-table shrink hacks.
- Purpose-built cards/rows when table density becomes unusable.
- Sticky contextual actions selectively.
- Full-width drawers/sheets.
- Prioritize customer-facing invoice/payment flows heavily.

---

## 18. Accessibility and Quality

- Full keyboard navigation for primary workflows.
- Visible focus state.
- Semantic headings and table structure.
- Accessible dialogs/drawers.
- No status conveyed by color only.
- Loading skeletons for major data surfaces.
- Useful empty states with direct next action.
- Reduced motion support.
- Print/PDF-friendly invoice and statement views.

---

## 19. Motion

Product motion should be restrained.

Use motion for:

- drawers;
- state transitions;
- timeline insertion;
- optimistic save feedback;
- preview updates;
- success confirmation.

Avoid decorative scroll animation inside the authenticated application.

---

## 20. Implementation Rule for Codex

When implementing a flagship surface, use Mobbin MCP to inspect the linked reference flows/screens before coding.

Do not clone any one product. Synthesize the strongest patterns into Lumina’s information architecture, current domain model and brand.

The final test is not visual similarity. It is whether Lumina feels **faster, clearer, and more operationally useful** than its current version.
