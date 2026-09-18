# Lumina v2 — Mobbin App Reference Library

**Status:** APPROVED REFERENCE SET  
**Scope:** `apps/web` design overhaul  
**Companion document:** `docs/lumina-v2/06_APP_DESIGN_OVERHAUL.md`

This library gives Codex a broad set of **real finance/product UI references** to inspect with the Mobbin MCP before changing Lumina's flagship surfaces.

The purpose is not to clone one app. It is to build a coherent Lumina design by borrowing the strongest patterns for hierarchy, density, navigation, financial state, forms, tables, customer documents and responsive behavior.

---

## 1. How Codex Must Use This Library

For every flagship surface:

1. Open the current Lumina implementation first.
2. Inspect the **Primary references** listed for that surface with Mobbin MCP.
3. Inspect at least one **Secondary reference** where useful.
4. Identify specific patterns to borrow: hierarchy, spacing, action placement, density, controls, master-detail, document preview, etc.
5. Adapt those patterns to Lumina's real domain model and existing data.
6. Do not invent functionality merely because a reference has it.
7. Do not reproduce another company's branding, copy, exact component styling or page layout one-for-one.
8. Compare the completed Lumina implementation against the reference set in browser screenshots.

When a Mobbin reference and Lumina's financial rules conflict, Lumina's rules win.

---

# 2. Overall Financial Workspace / Dashboard

## Primary references

### Mercury — financial workspace calmness
https://mobbin.com/screens/a06d508c-cdb8-4973-8f0b-3be7db44b351

Use for:

- calm light application chrome;
- hierarchy without heavy cards;
- restrained financial data presentation;
- strong whitespace around high-value information;
- mature visual tone.

Do not copy Mercury's banking IA; Lumina is receivables-first.

### Stripe — operational density
https://mobbin.com/screens/1659c0ab-3b5d-4ab7-99da-e1e99dc6ad8e

Use for:

- high information density without visual noise;
- restrained metric treatment;
- data-first hierarchy;
- mature sidebar/topbar relationships;
- subtle borders and surfaces.

### Airwallex — business-finance dashboard
https://mobbin.com/screens/79d7713e-740c-42d9-93f3-1bbb2e47027a

Use for:

- financial summaries;
- operational dashboard composition;
- professional B2B tone;
- navigation hierarchy.

### Xero — receivables/accounting overview
https://mobbin.com/screens/7e99b13f-3003-4846-98b4-0e9f939f4969

Use for:

- receivables-oriented modules;
- money-coming-in thinking;
- aging/customer balance context;
- practical, actionable accounting presentation.

## Secondary references

### Midday
https://mobbin.com/screens/d508e201-5a04-464b-8891-98ddb426ed50

Use for:
- clean small-business financial summary;
- minimal navigation;
- modern compact typography.

### HoneyBook
https://mobbin.com/screens/7441f67f-33b3-469f-8396-063c45a8a398

Use for:
- approachable small-business tone;
- actionable homepage structure;
- less intimidating finance UI.

### QuickBooks
https://mobbin.com/screens/bc88a120-f08a-47ae-83a4-ec153ae80e12

Use selectively for:
- business-at-a-glance grouping;
- task/action-oriented finance concepts.

Avoid:
- copying its visually busy widget/dashboard density.

### Bonsai
https://mobbin.com/screens/95e5eb86-6ae4-4341-812f-4eff514ba111

Use for:
- small-business professional services feel;
- summary + task prioritization.

### Deel
https://mobbin.com/screens/d784bbd9-d9ff-4f4b-be16-20eca82fb631

Use for:
- finance table density;
- high-volume B2B operations.

### Square
https://mobbin.com/screens/200d50af-ca71-49d3-97bd-b060e10779d2

Use for:
- merchant-friendly finance presentation;
- approachable status/summary treatment.

### Revolut Business
https://mobbin.com/screens/44300a52-bfa9-4da4-b51b-a75431958233

Use selectively for:
- modern financial shell;
- dense but polished account controls.

### Whop
https://mobbin.com/screens/b6059966-2a7a-4db1-b127-2afdf2803004

Use selectively for:
- contemporary data/product shell ideas.

---

# 3. Invoice List / Receivables Index

## Primary references

### Mercury — invoicing list
https://mobbin.com/screens/24ad0e7d-5ac7-4938-aede-9ee54f94f676

Use for:

- compact top-level invoice summary;
- simple light table;
- status and due-date presentation;
- low-noise actions.

### Midday — master-detail invoicing
https://mobbin.com/screens/5313da10-8abf-4f2a-9aec-7a705b12ff3c

Use for:

- master-detail interaction;
- keeping list context while inspecting an invoice;
- clean row density;
- contextual action placement.

### Airwallex — invoicing operations
https://mobbin.com/screens/0e329fb4-02c5-4d4d-b123-a7d3b3a8ef22

Use for:

- B2B invoice table structure;
- professional row density;
- filter and status concepts.

### Deel — high-volume payable/invoice table
https://mobbin.com/screens/b2b2cb25-f852-42f9-a35a-9f227b120fa8

Use for:

- dense financial table hierarchy;
- status prominence;
- bulk/row action behavior.

## Secondary references

### Xero
https://mobbin.com/screens/193d7a34-87bc-4917-ad16-d3c0547b837e

Use for:
- practical status grouping and invoice operations.

### Acctual
https://mobbin.com/screens/7c2ac5b4-273a-4d21-b1bd-3f8abe1f50ce

Use for:
- modern light invoice listing;
- B2B invoicing information hierarchy.

### Oyster
https://mobbin.com/screens/e8c1a795-0a5b-45d1-a79f-7a9e999a1455

Use for:
- status-rich enterprise table patterns.

### Remote
https://mobbin.com/screens/10a90a56-5e53-4775-b58b-a378ed8a062e

Use for:
- enterprise-level table organization.

### Copilot
https://mobbin.com/screens/f0636c56-428f-4a96-b7db-b19cab674c18

Use for:
- professional-services client billing tone.

### HoneyBook
https://mobbin.com/screens/4c378366-46a0-4dd6-9863-6154b447faa1

Use for:
- small-business friendliness.

### Outseta
https://mobbin.com/screens/20f7f049-8cf1-4bb5-8a6e-ebc6ac577135

Use for:
- simple SaaS billing table patterns.

### Whop
https://mobbin.com/screens/1891947b-888b-4357-8fab-3be48bbae45b

Use selectively for:
- modern status and table presentation.

---

# 4. Invoice Creation / Editing

This is the most important Mobbin reference group for the T020 invoice experience.

## Primary references

### Mercury — Creating an invoice
https://mobbin.com/flows/ef4623ce-bc68-4006-9c98-f720a4546769

Use for:

- guided authoring;
- form + document-preview relationship;
- due-date/payment settings;
- clear review/send sequence;
- calm financial document presentation.

### Stripe — Creating an invoice
https://mobbin.com/flows/03c71446-31eb-497b-b715-3419cf8cd922

Use for:

- editor + live preview;
- progressive disclosure;
- customer/currency/items/payment/delivery grouping;
- optional settings without overwhelming the main task;
- customer-facing invoice preview.

### Airwallex — Creating an invoice
https://mobbin.com/flows/45967791-df7e-43f8-954a-4c45b5e30e20

Use for:

- structured invoice sections;
- professional line-item editing;
- tax configuration;
- due-date setup;
- invoice details/review.

### Acctual — Creating an invoice
https://mobbin.com/flows/164ea2a9-05d1-44d3-9d7b-61d2afeba6cc

Use for:

- modern B2B invoice authoring;
- document-oriented visual hierarchy;
- compact configuration.

## Secondary references

### PayPal
https://mobbin.com/flows/12250cf7-9192-4d0f-bff7-3d61a7ce2ea0

Use for:
- clear invoice preview/review;
- payment-facing simplicity.

### Melio
https://mobbin.com/flows/e7de288d-b97a-4440-90e3-c338c6840af3

Use for:
- compact finance forms;
- step/action placement;
- small-business friendliness.

### Revolut Business
https://mobbin.com/flows/3e11dd43-e218-4648-b25d-5f28ac6c16f9

Use selectively for:
- polished B2B finance controls.

### Squarespace
https://mobbin.com/flows/92c71e4f-ef00-4bd1-a84a-427bd3e2e8ca

Use selectively for:
- very simple client-invoice creation;
- minimal form pattern.

---

# 5. Invoice Detail / Document + Activity

## Primary references

### Midday master-detail
https://mobbin.com/screens/5313da10-8abf-4f2a-9aec-7a705b12ff3c

Use for:
- side-by-side record selection/detail;
- keeping document context;
- concise actions.

### Acctual invoice view
https://mobbin.com/screens/254ac59a-5b08-4f79-856c-f001f801ddce

Use for:
- invoice/document presentation;
- financial summary hierarchy.

### Mercury hosted/invoice presentation
https://mobbin.com/screens/4942a92a-7afb-42d4-b892-6162970c5f0e

Use for:
- mature invoice document styling;
- calm information order.

### Stripe invoice preview
https://mobbin.com/screens/4a5466ac-f8e6-44ee-ac93-61f7604655c6

Use for:
- true document preview;
- financial-document composition.

---

# 6. Customer List / Customer 360

## Primary references

### Wave — customer account detail
https://mobbin.com/screens/dc5e568f-bc0a-4306-ab49-3a0e2c167d40

This is one of the strongest Customer 360 references for Lumina.

Use for:

- customer identity + commercial summary;
- invoices/payments/financial history relationship;
- account-level context;
- approachable small-business finance design.

### Xero — customer/contact account
https://mobbin.com/screens/07090bff-d36a-443b-99ac-10cb7ca654ea

Use for:

- accounting relationship view;
- customer history;
- receivables-oriented account context.

### Stripe — customer detail
https://mobbin.com/screens/731c4495-3c95-42b2-9502-5a1b60ab96eb

Use for:

- clean record-detail hierarchy;
- dense financial/customer information;
- tabs and related objects.

### Jobber — client detail
https://mobbin.com/screens/6c5f4d81-1027-4a3a-ab3c-576b2ae164c3

Use for:

- client-centric service-business account presentation;
- contact + work/history relationship.

## Secondary references

### Shopify
https://mobbin.com/screens/bdacd18e-3af1-43fb-964e-d59299a27ce6

Use for:
- strong customer profile hierarchy;
- history/summary patterns.

### Lightfield
https://mobbin.com/screens/f1244a10-3103-4ca1-87d6-df5eeef71f46

Use for:
- modern customer account workspace.

### Square
https://mobbin.com/screens/251593b6-2394-45c4-878a-b96a00e18ece

Use for:
- merchant/customer simplicity.

### Linear
https://mobbin.com/screens/5902db10-ef77-4e6e-aa3a-f3d0f9df5b31

Use selectively for:
- highly polished record-detail layout and tabs, not financial semantics.

### PayPal
https://mobbin.com/screens/56eedd3d-2d21-4389-80c4-fe0f10862a34

Use for:
- customer/payment relationship ideas.

### HoneyBook
https://mobbin.com/screens/55c66ffc-b64d-4121-a611-87ea0485505d

Use for:
- client relationship friendliness.

---

# 7. Payments / Reconciliation / Transaction Detail

## Primary references

### Mercury — transactions/payments
https://mobbin.com/screens/14ec88c9-760c-44a2-bd34-d0e0de2f3aff

Use for:

- clean financial transaction table;
- transaction status hierarchy;
- compact controls;
- mature light workspace.

### Stripe — transactions/payments
https://mobbin.com/screens/4bbb46ff-471b-494d-a543-4e5075d63788

Use for:

- high-volume payment operations;
- filters;
- clear state/value hierarchy;
- technical reference presentation.

### Midday — transaction master/detail
https://mobbin.com/screens/598a7d3c-339d-4709-a97b-91703a44ee36

Use for:

- list + detail panel;
- contextual inspection without route churn.

### Acctual
https://mobbin.com/screens/851a29ec-a743-4f85-98d5-a16c304f9663

Use for:

- accounts-receivable/payment operations;
- modern light financial table treatment.

## Secondary references

### Xero
https://mobbin.com/screens/85cdec88-2dba-400d-aa56-172760982a9b

Use conceptually for:
- reconciliation workflows;
- accounting state handling.

### QuickBooks
https://mobbin.com/screens/869dfa1d-8c53-4dac-96a1-6fd98999d1b8

Use conceptually for:
- reconciliation/task states.

Avoid copying its visual density wholesale.

### Wave
https://mobbin.com/screens/008bb53e-daf2-4770-9a9f-b8d1aa1a656a

Use for:
- approachable transaction lists.

### Melio
https://mobbin.com/screens/181da04e-d758-4614-bbd5-1a83b5984de9

Use for:
- payment operational states;
- approachable B2B financial UI.

### Shopify
https://mobbin.com/screens/2b2c6bc8-1991-4cce-8a70-cc056d32facc

Use selectively for:
- transaction detail structure.

### Whop
https://mobbin.com/screens/b3d17af6-37c1-45bd-aaa7-7aa86c9b4dbc

Use selectively for:
- contemporary financial tables.

### Retool
https://mobbin.com/screens/f074d0b0-63f2-41a9-83b2-9d2e8cda443b

Use selectively for:
- dense operational table ergonomics.

### YNAB
https://mobbin.com/screens/98ad3288-dcea-44b6-b602-339cd4f43296

Use selectively for:
- financial transaction scanning patterns.

---

# 8. Settings / Team / Organization Management

## Primary references

### Resend — team/settings
https://mobbin.com/screens/90af3e56-1038-4468-80f8-b5edad609a5f

Use for:

- very clean settings hierarchy;
- restrained table/member management;
- secondary settings navigation.

### Sentry — organization settings
https://mobbin.com/screens/add6fdd9-88b8-491c-95ea-d768117f31bc

Use for:

- mature settings information architecture;
- clear organization-level controls.

### Sprig
https://mobbin.com/screens/3bbddd9e-6eac-4ce5-8cf9-47ed21c0d767

Use for:

- member/settings panels;
- modern light SaaS form hierarchy.

### Bonsai
https://mobbin.com/screens/f83db023-bc4e-4cce-af72-a244c157e94b

Use for:

- small-business settings tone;
- approachable team management.

## Secondary references

### Churnkey
https://mobbin.com/screens/8591d4a9-72c0-4927-8442-89296cc7ccf6

### Oyster
https://mobbin.com/screens/85c549e6-23b3-4edf-9b16-d794417d5f66

### Jitter
https://mobbin.com/screens/b627c340-604c-4a0c-8351-8d5cd66ce38f

### Bloom
https://mobbin.com/screens/cc8f1295-6ef1-430c-a15a-e127e6ae4863

### Krea AI
https://mobbin.com/screens/77f3b14c-ebf4-48aa-bcf5-a5a1e492ec55

### Dribbble
https://mobbin.com/screens/b4dee159-c809-4b72-9db2-b17432637ce5

Use secondary references only for component/spacing patterns, not finance semantics.

---

# 9. Public Invoice / Customer Payment Experience

## Primary references

### Mercury — hosted invoice
https://mobbin.com/screens/4942a92a-7afb-42d4-b892-6162970c5f0e

Use for:

- premium but restrained customer-facing invoice;
- document hierarchy;
- clear amount/due state.

### Midday — invoice
https://mobbin.com/screens/328c47b5-51d9-4e71-ac3a-ee46f4c65304

Use for:

- simple modern document styling;
- strong whitespace;
- approachable small-business presentation.

### Acctual — invoice view
https://mobbin.com/screens/254ac59a-5b08-4f79-856c-f001f801ddce

Use for:

- B2B invoice document structure;
- financial summary.

### Stripe — hosted invoice preview
https://mobbin.com/screens/4a5466ac-f8e6-44ee-ac93-61f7604655c6

Use for:

- document/payment experience;
- clear customer-visible configuration.

### PayPal — invoice presented to customer
https://mobbin.com/screens/ad5c4099-923b-41b6-b1bc-6a12ef09a8fb

Use for:

- immediate customer clarity;
- prominent payment state/action.

## Secondary references

### Melio
https://mobbin.com/screens/a9ac906b-76df-4dc7-be1d-386c37cd78dd

### Airwallex
https://mobbin.com/screens/21b63c71-8de9-431e-80b6-a1db111b9fef

### Outseta
https://mobbin.com/screens/5e398f4b-48a6-4fbd-996c-3396a5b8dc22

### Squarespace
https://mobbin.com/screens/e019f232-1cde-4824-8435-05d757118fdc

### Fiverr
https://mobbin.com/screens/c0bbb714-71f7-4230-88dd-564ff0349061

Use these for payment/document patterns only; Lumina should remain merchant-branded and B2B-oriented.

---

# 10. Auth / Business Onboarding / Payment Setup

## Primary references

### Mercury — onboarding
https://mobbin.com/flows/5fcdc0f3-f4bd-4687-8303-a6129ce532cd

Use for:

- high-trust financial onboarding;
- calm focused forms;
- progress and supporting explanation;
- professional whitespace.

### Mercury — company information onboarding
https://mobbin.com/flows/4986441c-66bc-4337-bd1b-df1dbf5335c7

Use for:

- business-profile information grouping;
- enterprise-capable trust cues.

### Airwallex — business profile onboarding
https://mobbin.com/flows/2f44eca9-8e57-44c5-8e7a-6a90c93e85f8

Use for:

- B2B company information flow;
- finance/compliance form hierarchy.

### Melio — account setup
https://mobbin.com/flows/19e7920f-cdc3-4612-bc67-2660ed342ece

Use for:

- SME-friendly onboarding;
- low-friction step progression;
- approachable copy/layout.

## Secondary references

### Wave — setup
https://mobbin.com/flows/f15ab950-6a55-4e71-9c1b-c1cc99f81eca

Use for:
- simple small-business onboarding.

### QuickBooks — completing onboarding
https://mobbin.com/flows/1a0a53a6-d570-41f9-be28-c537ae0d5831

### QuickBooks — extended onboarding
https://mobbin.com/flows/b9808087-6da2-4b52-8732-96f3eed897a4

Use selectively for:
- business/accounting data requirements;
- progress concepts.

Avoid copying its breadth or complexity.

---

# 11. Reference Synthesis by Lumina Surface

Use this matrix when Codex needs a fast shortlist.

| Lumina surface | First reference | Second reference | Third reference |
| --- | --- | --- | --- |
| App shell | Mercury dashboard | Stripe dashboard | Airwallex dashboard |
| Dashboard | Mercury | Xero | Stripe |
| Invoice list | Mercury | Midday | Airwallex |
| Invoice create/edit | Stripe | Mercury | Airwallex |
| Invoice detail | Midday | Acctual | Mercury |
| Customer list/detail | Wave | Xero | Stripe |
| Payments | Mercury | Stripe | Midday |
| Reconciliation | Xero conceptually | QuickBooks conceptually | Acctual visually |
| Receipts | Mercury transaction/document grammar | Midday | Acctual |
| Settings/team | Resend | Sentry | Sprig |
| Payment setup | Mercury onboarding | Airwallex onboarding | Melio onboarding |
| Login/register | Mercury onboarding | Melio | Wave |
| Public invoice | Mercury | Midday | Stripe |
| Mobile financial UI | Mercury flows | Melio flows | Stripe flow |

---

# 12. Patterns Lumina Should Synthesize

Across the research set, the strongest recurring patterns are:

### A. Light neutral workspace

Modern finance products generally let data carry the weight rather than placing every surface in a strong brand color.

### B. One dominant primary action

Create/send/pay actions are obvious; destructive and secondary actions recede into menus.

### C. Tables as working surfaces

Dense operational products use tables/lists with good alignment, quiet separators, compact filtering and contextual detail.

### D. Progressive disclosure

Advanced options appear when needed instead of filling the first viewport.

### E. Document preview for billing

Invoice authoring is substantially easier when the user can see what the customer will receive.

### F. Master-detail for operational review

Transaction/invoice/customer inspection often works better in a split view or drawer than constant full-page navigation.

### G. Finance-specific status hierarchy

Color is secondary to clear text labels, amounts, dates and exception explanation.

### H. Quiet branding in the authenticated app

The strongest financial workspaces use brand accents selectively and reserve expressive visual identity for marketing.

---

# 13. Patterns Lumina Should Avoid

Do not copy the following merely because they appear in references:

- generic widget dashboards with every module in a rounded card;
- permanent row-action button clusters;
- huge hero-like type inside operational pages;
- excessive gradients;
- glow effects;
- tiny low-contrast table text;
- complexity from accounting suites that Lumina does not yet need;
- banking/card navigation from Mercury/Revolut/Airwallex that is irrelevant to receivables;
- dark fintech styling simply because it looks technically sophisticated;
- hidden financial state behind color-only badges;
- desktop table shrinkage on mobile.

---

# 14. Final Reference Rule

For each page, Codex should be able to state:

> "I used reference X for hierarchy, Y for interaction, and Z for density, then adapted those patterns to Lumina's current data and workflow."

If the implementation cannot explain which product problem a reference pattern solves, the pattern should not be copied.
