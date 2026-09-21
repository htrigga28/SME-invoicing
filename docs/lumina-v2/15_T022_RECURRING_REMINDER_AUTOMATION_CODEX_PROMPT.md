# Lumina v2 — Codex Prompt: T022 Recurring Billing, Scheduled Sends & Reminder Automation

**Status:** READY TO EXECUTE  
**Task:** T022  
**Branch:** feat/t022-recurring-reminder-automation  
**Base:** latest dev after T021 / PR #27

T021 is merged. It established Resend transactional email, durable communication attempts, recipient-level delivery state, verified Resend webhooks, uncertain-send recovery, public invoice view events, and unified invoice activity.

T022 must build on that infrastructure.

Do not create another email system. Do not start another planning phase. Implement the vertical slice completely, perform browser QA, and open one PR into dev.

---

# 1. Goal

Give Lumina its first real automation layer.

A business should be able to:

1. create a recurring invoice schedule;
2. define when it repeats;
3. choose payment terms;
4. optionally send each generated invoice automatically;
5. pause, resume, or end the schedule;
6. configure organisation-wide payment reminders;
7. automatically remind customers before/after due dates;
8. suppress reminders for a customer or individual invoice;
9. schedule a one-off draft invoice to send on a future business date;
10. see every automated action in the existing invoice activity timeline;
11. trust that duplicate cron invocations, retries, restarts, and provider ambiguity will not create duplicate invoices or duplicate email attempts.

The result should feel like native Lumina workflows, not background scripts hidden behind settings.

---

# 2. Required reading

Read completely:

1. docs/lumina-v2/00_BUILD_BRIEF.md
2. docs/lumina-v2/01_FEATURE_AND_BUILD_SEQUENCE.md
3. docs/lumina-v2/02_UI_UX_DIRECTION.md
4. docs/lumina-v2/03_CODEX_EXECUTION_GUIDE.md
5. docs/lumina-v2/06_APP_DESIGN_OVERHAUL.md
6. docs/lumina-v2/07_MOBBIN_APP_REFERENCE_LIBRARY.md
7. docs/lumina-v2/14_T021_INVOICE_DELIVERY_ACTIVITY_CODEX_PROMPT.md for intent only; current code/PR #27 is authoritative where implementation diverged.
8. docs/design-system.md
9. docs/status-rules.md
10. docs/rbac-matrix.md
11. docs/database-schema.md
12. docs/api-contracts.md
13. docs/deployment-runbook.md
14. docs/release-checklist.md

Then inspect the actual T021 implementation:

- apps/api/src/modules/communications/*
- apps/api/src/modules/invoices/*
- apps/api/src/modules/payments/*
- apps/api/src/database/schema.ts
- apps/api/src/common/business-date.ts
- apps/api/src/database/seed.ts
- apps/web/src/features/invoices/*
- current navigation/layout primitives.

---

# 3. Important current-state facts

## Email provider

T021 uses Resend, not Brevo.

Use the existing ResendEmailProvider, communications service, immutable provider request snapshots, webhook correlation, idempotency/retry protections, and recipient delivery state.

Do not add Brevo. Do not send reminders directly through the Resend SDK from a new service.

## Communication ambiguity

T021 deliberately distinguishes accepted, delivered, deferred, failed, and submission uncertain.

Preserve this.

Automation must NEVER respond to an uncertain email submission by blindly creating a fresh new send.

## Business timezone

Current business-date authority is Africa/Lagos via apps/api/src/common/business-date.ts.

T022 remains Nigeria-date based. Do not add a broad timezone settings project in this task.

## Deployment

The NestJS API runs as one Vercel Function. There is no persistent worker.

Do not add setInterval, in-memory cron, BullMQ, Redis solely for scheduling, a second backend service, or a long-running worker.

T022 uses a durable PostgreSQL job ledger plus one protected scheduled executor endpoint.

---

# 4. Scheduling architecture — LOCKED DIRECTION

Use:

**PostgreSQL-backed automation jobs + one Vercel Cron trigger**

The application/database owns automation truth. Vercel only wakes the executor.

References to inspect:

- https://vercel.com/docs/cron-jobs
- https://vercel.com/docs/frameworks/backend/nestjs
- https://vercel.com/changelog/cron-jobs-now-support-100-per-project-on-every-plan

Do not use Vercel Workflow for T022.

Reason: the current application already has a strong Postgres transactional model; recurring schedules and reminder policy should remain inspectable domain records; one daily trigger is enough for the MVP's date-based semantics.

---

# 5. Automation cadence

T022 is business-date scheduled, not minute-precision scheduled.

Use one daily executor run.

Target production schedule:

    0 8 * * *

This is approximately 09:00 in Africa/Lagos.

Suggested endpoint:

    GET /internal/automation/run

Protect it with CRON_SECRET using the current Vercel Cron authorization convention after checking the current docs.

Do not expose an unauthenticated runner.

There is NO clock-time picker in T022. Users choose dates/cadence.

Use copy such as:

- Send on Sep 30
- Next invoice Sep 30

Do not promise an exact clock time.

---

# 6. Add a generic automation-job ledger

Create a durable generic table, suggested name:

automation_jobs

Recommended fields:

- id
- organisationId
- kind
- resourceType
- resourceId
- scheduledFor — business date
- runAt — optional timestamp if useful internally
- idempotencyKey — UNIQUE
- status
- attemptCount
- maxAttempts
- claimToken
- claimedAt
- nextAttemptAt
- lastError — safe bounded text
- payloadRedacted — JSONB
- completedAt
- skippedAt
- createdAt
- updatedAt

Recommended statuses:

- pending
- running
- completed
- failed
- needs_attention
- skipped
- cancelled

Recommended kinds:

- recurring_invoice_generate
- invoice_reminder_send
- invoice_scheduled_send

Do not create a visual workflow builder.

---

# 7. Job claiming / concurrency

The runner must survive:

- duplicate cron requests;
- concurrent executor requests;
- Vercel retries;
- process death;
- database reconnect;
- stale claims.

Use a database-backed lease/claim model.

Preferred pattern:

- select/claim bounded due rows transactionally;
- use PostgreSQL FOR UPDATE SKIP LOCKED or an equally safe pattern;
- unique idempotency keys;
- claim token;
- claimed timestamp;
- stale claim recovery after a bounded lease;
- small batch size.

Do not hold a DB transaction open during a Resend network call.

Claim first, commit claim, perform side effect, persist outcome in a new short transaction.

Every processor re-checks current domain eligibility after claiming.

---

# 8. Runner sequence

One executor invocation should approximately:

1. resolve current Africa/Lagos business date;
2. materialize due recurring jobs;
3. materialize due reminder jobs;
4. ensure scheduled-send jobs are eligible;
5. reclaim stale jobs when safe;
6. claim a bounded batch;
7. process each job independently;
8. persist completed / skipped / retry / needs-attention outcome;
9. return a safe execution summary.

Safe response example:

    {
      "date": "2026-10-01",
      "claimed": 12,
      "completed": 9,
      "skipped": 2,
      "needsAttention": 1,
      "failed": 0
    }

No customer PII or provider payloads in cron response/logs.

---

# 9. Recurring invoice domain

Add recurring_invoice_schedules and a line-item/template representation.

Suggested schedule fields:

- id
- organisationId
- customerId
- name
- status
- frequency
- startDate
- nextIssueDate
- endDate nullable
- dueTermsDays
- autoSend
- toRecipients JSONB
- ccRecipients JSONB
- emailSubject nullable
- customerReference nullable
- notes nullable
- discountKobo
- taxKobo
- lastGeneratedAt
- lastInvoiceId nullable
- createdByUserId
- timestamps

Status values:

- active
- paused
- completed
- cancelled

Frequency values for T022:

- weekly
- monthly
- quarterly
- yearly

Do not add arbitrary cron expressions to the user UI.

Do not add hourly/daily recurring billing in this task.

---

# 10. Recurring schedule line items

Use a separate recurring-template line-item table unless the current schema strongly justifies a safer equivalent.

Suggested table:

recurring_invoice_schedule_line_items

Fields:

- scheduleId
- organisationId
- optional catalogueItemId for traceability
- description snapshot
- quantity
- unitPriceKobo
- sortOrder

Important rule:

**Generated invoices use the schedule's saved snapshot, not live catalogue pricing.**

If a catalogue price changes later, an existing recurring schedule must not silently change. The user explicitly edits the recurring schedule to change future amounts.

Generated invoices remain normal invoice snapshots.

---

# 11. Recurring occurrence ledger

Add recurring_invoice_occurrences.

Recommended fields:

- id
- organisationId
- scheduleId
- scheduledFor
- invoiceId nullable
- status
- errorSummary nullable
- generatedAt nullable
- timestamps

UNIQUE(scheduleId, scheduledFor)

This is a second defense against duplicate invoice generation.

Statuses:

- pending
- generated
- failed
- skipped

Even if cron is invoked twice, only one invoice may exist for one schedule occurrence.

---

# 12. Recurrence-date semantics

Make recurrence deterministic and heavily tested.

## Weekly

Next date = previous scheduled occurrence + 7 days.

## Monthly

Anchor to the ORIGINAL schedule day.

Example:

    Start Jan 31
    → Feb 28/29
    → Mar 31
    → Apr 30
    → May 31

Do not drift permanently to the 28th after February.

## Quarterly

Same original-anchor rule, +3 months.

## Yearly

Preserve original month/day.

Feb 29 becomes Feb 28 in a non-leap year and returns to Feb 29 in a leap year.

## End date

If next computed occurrence is after endDate:

- mark schedule completed;
- create no future occurrence.

Write pure utility tests for all edge cases.

---

# 13. Pause / resume / cancel semantics

## Pause

- no new invoice is generated;
- existing generated invoices remain untouched;
- pending schedule jobs are cancelled/skipped safely;
- preserve next schedule information for display.

## Resume

Do NOT automatically generate every historical missed invoice.

Default resume rule:

**Advance to the first occurrence on or after the current business date.**

Missed periods are skipped.

Show the new next date before confirmation.

Do not surprise a customer with several old invoices/emails.

## Cancel / End

- terminal;
- no new occurrences;
- existing invoice history remains.

Use confirmation dialogs.

---

# 14. Recurring invoice generation

When a recurring job runs:

1. lock/validate schedule;
2. confirm active and due;
3. create/get occurrence row;
4. enforce unique schedule+date;
5. snapshot recurring template into a normal invoice;
6. issue date = scheduled occurrence date;
7. due date = issue date + dueTermsDays;
8. normal server-authoritative invoice total logic applies;
9. update occurrence with invoice ID;
10. compute next schedule date from original recurrence anchor;
11. update next date/status;
12. if autoSend=false, leave generated invoice as draft;
13. if autoSend=true, issue + email through T021.

Do not duplicate invoice calculation logic.

Extract/reuse existing invoice creation domain logic safely.

---

# 15. Auto-send recurring invoices

If autoSend=true:

- use schedule To/CC values;
- use current public URL generation;
- use existing T021 communications infrastructure;
- create normal communication attempts;
- delivery state appears in invoice Activity.

If email delivery is not configured:

- preserve T021 partial-success semantics;
- never fake delivered;
- record a safe automation warning/needs-attention state.

If provider submission is uncertain:

- DO NOT create a second new email attempt automatically;
- preserve the existing uncertain communication;
- automation job becomes needs_attention or equivalent;
- T021 same-attempt recovery rules remain authoritative.

---

# 16. One-off scheduled invoice send

Extend T021's send dialog.

For a draft invoice support:

- Send now
- Schedule

Schedule fields:

- date only;
- To;
- optional CC;
- subject.

When scheduled:

- invoice remains draft;
- persist scheduledSendDate or a clean equivalent;
- create/upsert one invoice_scheduled_send job;
- show scheduled state on invoice detail/list.

Actions:

- Change scheduled date
- Cancel scheduled send
- Send now

## Send now

If a scheduled job exists:

- cancel it atomically;
- then use normal T021 Send behavior.

## At execution

Re-check invoice:

- still draft;
- public send allowed;
- customer eligible;
- scheduled record still current.

Then issue + email through T021.

If already sent/cancelled/voided manually:

- mark job skipped;
- do not enter an error loop.

---

# 17. Organisation reminder settings

Add organisation-level reminder configuration.

Suggested tables:

organisation_reminder_settings

Fields:

- organisationId unique
- enabled
- updatedByUserId
- timestamps

reminder_steps

Fields:

- id
- organisationId
- relativeDays
- subjectTemplate
- bodyTemplate
- enabled
- sortOrder
- timestamps

Interpretation:

    -3 = 3 days before due
     0 = due date
    +1 = 1 day overdue
    +7 = 7 days overdue

Allowed range: approximately -30 to +60.

One active step per relative day.

---

# 18. Reminder defaults

Automatic reminders are OFF by default for existing/new organisations until Owner/Admin explicitly enables them.

When first enabling, offer suggested steps:

- 3 days before due;
- 1 day after due;
- 7 days after due.

Do not silently begin emailing existing customers after migration.

The enable action must explain its effect.

---

# 19. Reminder templates

Each reminder step has Subject and Body.

Keep body plain-text authoring in T022.

Render safe HTML email through existing communications utilities.

Supported variables:

- {{businessName}}
- {{customerName}}
- {{invoiceNumber}}
- {{amountDue}}
- {{dueDate}}
- {{publicInvoiceUrl}}

Do not implement arbitrary HTML templates.

Escape interpolated values.

Reject unknown template variables with useful validation.

Important:

**amountDue is resolved at SEND TIME from authoritative current invoice balance.**

For partial payment, remind only about remaining balance.

---

# 20. Reminder eligibility

A reminder is eligible only when:

- organisation reminder automation is enabled;
- customer is not opted out;
- invoice is not opted out;
- invoice is issued/public;
- balance due > 0;
- invoice is not paid;
- invoice is not cancelled;
- invoice is not voided;
- step timing is applicable.

Re-check current authoritative state immediately before send.

---

# 21. Customer + invoice opt-out

Implement suppression, not a rules engine.

## Customer

Add automaticRemindersEnabled, default true.

Customer UI:

Automatic payment reminders — On / Off

## Invoice

Add automaticRemindersEnabled, default true.

Invoice detail allows Owner/Admin/Accountant to enable/disable future automatic reminders.

Effective rule:

    organisation.enabled
    AND customer.automaticRemindersEnabled
    AND invoice.automaticRemindersEnabled

Do not add force-enable precedence or custom per-customer schedules in T022.

---

# 22. Missed reminder semantics

The daily runner must be safe when a day was missed.

Do not only query scheduledDate === today.

## Missed before-due reminder

If its scheduled date is already past and invoice is now due/overdue:

- skip it;
- do not send "due soon" after the due date.

## Multiple overdue reminders now due

Do not burst several reminders in one executor run.

For one invoice on one day:

**Send only the latest applicable unsent reminder step.**

Older missed reminder steps become skipped/superseded.

Example:

Configured +1 and +7.
Runner unavailable until day +8.
Send +7 only.

Persist enough history to explain what happened.

---

# 23. Extend T021 communications

Existing purpose:

- invoice_delivery

Add:

- payment_reminder

Do not create a second communications table.

Add a dedicated method such as sendPaymentReminderEmail(...) that reuses:

- provider adapter;
- attempt persistence;
- recipients;
- provider snapshot;
- idempotency;
- webhook events;
- uncertainty recovery.

Provider tags should distinguish reminders.

---

# 24. Reminder timeline entries

Extend T021 unified Activity.

Examples:

    Automatic reminder sent
    3 days before due · accounts@northstar.example

    Reminder delivered
    accounts@northstar.example

    Automatic reminder sent
    Invoice overdue by 7 days · ₦28,400 remaining

Do not display raw automation job IDs in primary UI.

---

# 25. Automation failure visibility

Do not build a giant admin console.

At minimum:

- recurring schedule detail shows latest automation error;
- reminder settings shows a small Needs attention count if relevant;
- invoice Activity shows communication failure.

If cross-feature visibility genuinely needs it, a compact /automation page under Operations is acceptable.

Do not expose provider raw responses, secrets, or stack traces.

---

# 26. Retry policy

Generic jobs:

- bounded attempts;
- no tight loops;
- nextAttemptAt persisted;
- suggested max 3 application attempts.

But email ambiguity follows T021.

## Definite pre-provider failure

May safely retry using the same T021 attempt/idempotency path where supported.

## Submission uncertain

Do not generate a fresh send.

Set automation job needs_attention and use existing recovery behavior.

## Idempotency expired

Do not automatically create a new attempt.

Require manual resolution/new send.

Avoiding duplicate customer emails is more important than hiding an automation warning.

---

# 27. User-facing routes

Add:

## /recurring-invoices

List schedules.

Desktop information:

- Name
- Customer
- Amount
- Frequency
- Next invoice
- Send mode
- Status
- actions

Primary:

Create recurring invoice

Tabs/filters:

- Active
- Paused
- Ended

## /recurring-invoices/new

Reuse T020 invoice editor patterns.

Structure:

1. Customer
2. Line items
3. Schedule
4. Payment terms
5. Delivery
6. Customer-facing preview

## /recurring-invoices/:id

Show:

- status;
- cadence;
- next invoice date;
- amount/template;
- customer;
- due terms;
- delivery mode;
- generated invoice history;
- latest automation state;
- Edit;
- Pause/Resume;
- End.

## /settings/reminders

Organisation reminder settings.

---

# 28. Navigation

Update minimally.

Under Receivables:

    Invoices
    Recurring
    Customers
    Payments
    Receipts
    Products & Services

Under Settings:

    Payment setup
    Payment reminders
    Team
    Audit log

Do not introduce a broad Sales/Automation IA redesign in T022.

---

# 29. Mobbin references — REQUIRED

Use Mobbin MCP actively before building the flagship flows.

Do not browse randomly.

## Recurring invoice creation

Xero — Creating a repeating invoice  
https://mobbin.com/flows/ce7039a5-ac72-41e4-917c-fc639657e10e

Use for recurrence clarity and template/schedule relationship.

Midday — Creating a recurring invoice  
https://mobbin.com/flows/8e691dac-9224-422e-a408-726b8f54c241

Use for contemporary compact hierarchy.

Revolut Business — Creating a recurring invoice  
https://mobbin.com/flows/70d1f06b-a35e-4da5-b2bd-3f5466c6949d

Use for progressive schedule/delivery configuration.

## Recurring list

Xero  
https://mobbin.com/screens/a0e1dbdc-815a-4108-8050-1af8e5df25ec

Midday  
https://mobbin.com/screens/d6c9d842-f05c-4b34-8781-c4e7f1c9666f

Use for next-date prominence, status, and action hierarchy.

## Reminder automation

PayPal — Editing auto reminders  
https://mobbin.com/flows/b6ccd899-f591-4aaf-ad76-e1cac79a311b

Stripe reminder settings  
https://mobbin.com/screens/3a517d71-5a75-495a-bb14-b7ced2c02ef0

Xero reminder settings  
https://mobbin.com/screens/6d85ac5d-f5f0-47d9-8aa9-5f79dde63080

Mercury — overdue reminder  
https://mobbin.com/flows/23dd05ef-f7d4-4395-8781-10e8798a07d4

Midday — sending a reminder  
https://mobbin.com/flows/6eb73d1e-1072-4859-aae7-ef998207bf9b

Borrow hierarchy, progressive disclosure, schedule clarity, and reminder-language clarity.

Do NOT copy their visual brands.

Stay inside Lumina's merged light financial workspace.

---

# 30. Recurring editor UX

Reuse T020 components.

Example Schedule block:

    Schedule

    Starts
    [ 30 Sep 2026 ]

    Repeats
    [ Monthly ▼ ]

    Payment terms
    [ Net 14 ▼ ]

    Ends
    (•) Never
    ( ) On date [ ... ]

    Delivery
    [x] Email each invoice automatically

    To
    accounts@northstar.example

    CC
    [ optional ]

At bottom show:

    Next invoice: Sep 30 · Due Oct 14

The next occurrence must be understandable BEFORE save.

---

# 31. Recurring list UX

Desktop:

    Recurring invoices                         [Create recurring invoice]

    [Active] [Paused] [Ended]                 Search

    NAME                 CUSTOMER       AMOUNT       REPEATS     NEXT       DELIVERY     STATUS    …
    Northstar retainer   Northstar      ₦78,400      Monthly     Sep 30     Automatic    Active    …

Mobile:

    Northstar retainer        Active
    Northstar Projects

    ₦78,400 · Monthly
    Next invoice Sep 30
    Automatic delivery

    […]

No tiny desktop table on mobile.

---

# 32. Reminder settings UX

Target structure:

    Payment reminders

    Automatically follow up on unpaid invoices.
    [ Enable automatic reminders ]

    Reminder sequence

    3 days before due
    Subject: Invoice {{invoiceNumber}} is due soon
    [Edit]

    1 day overdue
    Subject: Invoice {{invoiceNumber}} is overdue
    [Edit]

    7 days overdue
    Subject: Reminder: {{amountDue}} is still outstanding
    [Edit]

    [ + Add reminder ]

Editing a step can use a drawer/dialog.

Fields:

- timing;
- subject;
- message;
- variable helper;
- preview.

Do not expose cron/job concepts here.

---

# 33. Template preview

Show a clearly labeled synthetic preview.

Use:

- Adebayo Studio
- Northstar Projects
- INV-000184
- ₦78,400
- due date
- public URL CTA

Do not imply a preview was actually sent.

---

# 34. Invoice detail integration

Add a small Automation/Reminder state near current delivery/payment context.

Examples:

    Automatic reminders
    On · Next reminder Sep 28

or:

    Automatic reminders
    Off for this invoice

For scheduled draft:

    Scheduled to send
    Sep 30
    [Change] [Cancel schedule]

The Activity timeline must show generated/scheduled/reminder actions in readable language.

---

# 35. Customer integration

On customer detail/edit:

    Automatic payment reminders
    [ On ]

Helper copy:

When organisation reminders are enabled, this customer will receive the configured sequence for unpaid invoices.

Turning off does not alter financial state or delete history.

---

# 36. Payment interaction

Before each reminder send:

- read/recalculate authoritative balance;
- paid → skip;
- partially paid → use remaining balance;
- race with successful payment/reconciliation → lock/recheck so a fully paid invoice is not reminded after payment confirmation.

Reuse the transaction/lock discipline introduced during T021/payment hardening.

Do not infer balance client-side.

---

# 37. State separation

Do not add broad new invoice statuses.

A scheduled draft remains draft until executor issues it.

Recurring schedule status is separate.
Automation-job status is separate.
Reminder communication status is separate.

Do not create invoice statuses such as reminder_sent, scheduled, or recurrence_active.

---

# 38. Audit

Audit significant actions:

- recurring schedule created/edited;
- paused/resumed/ended;
- automatic invoice generated;
- scheduled send created/changed/cancelled;
- reminder settings enabled/disabled;
- reminder step added/edited/deleted;
- customer reminder suppression changed;
- invoice reminder suppression changed.

Do not flood audit logs with internal claim/retry heartbeat events.

---

# 39. API shape

Choose final REST shape consistent with current NestJS conventions.

Expected conceptual endpoints:

    GET    /recurring-invoices
    POST   /recurring-invoices
    GET    /recurring-invoices/:id
    PATCH  /recurring-invoices/:id
    POST   /recurring-invoices/:id/pause
    POST   /recurring-invoices/:id/resume
    POST   /recurring-invoices/:id/cancel

    GET    /reminder-settings
    PUT    /reminder-settings
    POST   /reminder-settings/steps
    PATCH  /reminder-settings/steps/:id
    DELETE /reminder-settings/steps/:id

    POST   /invoices/:id/schedule-send
    PATCH  /invoices/:id/schedule-send
    DELETE /invoices/:id/schedule-send

    PATCH  /invoices/:id/reminder-preference
    PATCH  /customers/:id/reminder-preference

    GET    /internal/automation/run

Do not follow these mechanically if existing controller conventions give a cleaner contract. Document final endpoints.

---

# 40. RBAC

Owner/Admin:

- configure organisation reminder defaults;
- create/edit/pause/resume/end recurring schedules;
- schedule sends;
- manage customer/invoice reminder opt-outs.

Accountant:

- create/edit/pause/resume recurring schedules;
- schedule sends;
- manage invoice/customer reminder opt-outs;
- do not change organisation-wide reminder defaults if current settings policy reserves global configuration to Owner/Admin.

Viewer:

- read recurring list/detail;
- read automation state;
- read invoice timeline;
- no mutations.

Do not invent a new permission system.

---

# 41. Tenant isolation

Every new table/query is organisation scoped.

Negative tests:

- foreign recurring schedule ID;
- foreign reminder step ID;
- foreign scheduled-send job;
- foreign invoice/customer preference;
- runner derives ownership from stored resource, never caller-supplied organisation ID.

Generic automation jobs must not become a cross-tenant escape hatch.

---

# 42. Seed/demo data

Add safe demo data, no real email.

Include:

1. Active monthly schedule.
2. Paused schedule.
3. Completed/end-dated schedule.
4. Generated recurring invoice history.
5. Reminder sequence enabled.
6. Customer opted out.
7. Invoice opted out.
8. Draft scheduled to send.
9. Completed reminder job.
10. Needs-attention automation example.

Seed remains idempotent and production-safe.

---

# 43. Local deterministic executor

Add a safe command, e.g.:

    pnpm automation:run

Optional development/test-only date override:

    pnpm automation:run --as-of=2026-10-07

Do NOT expose arbitrary as-of date as a public production request parameter.

---

# 44. Cron security

Add CRON_SECRET to env validation/docs.

Production executor:

- fail closed if secret missing;
- validate Authorization securely;
- no user session needed;
- no organisation ID accepted from caller;
- do not log secret.

---

# 45. Vercel config

Add API-project cron config after confirming correct file location for the current Root Directory = apps/api project.

Desired schedule:

    {
      "crons": [
        {
          "path": "/internal/automation/run",
          "schedule": "0 8 * * *"
        }
      ]
    }

Do not change the three-project topology.

---

# 46. Tests — recurrence utilities

Cover:

- weekly;
- monthly 28/29/30/31;
- Jan 31 → Feb → Mar 31;
- leap year;
- quarterly;
- yearly Feb 29;
- end date;
- pause/resume;
- resume skips historical occurrences;
- no date drift.

Pure fast tests.

---

# 47. Tests — recurring jobs

Cover:

- one due schedule → one invoice;
- duplicate cron → no duplicate invoice;
- concurrent runners → no duplicate invoice;
- occurrence uniqueness;
- auto-send off → draft invoice;
- auto-send on → issued + communication;
- paused/cancelled while pending → skipped;
- archived/ineligible customer → safe error/attention state;
- next date advances only after successful generation;
- end date completes schedule.

Use real PostgreSQL concurrency tests where appropriate.

---

# 48. Tests — scheduled send

Cover:

- schedule draft;
- change date;
- cancel;
- manual send cancels scheduled job;
- executor sends once;
- duplicate runner no resend;
- invoice edited before send uses current values;
- invalid state skips;
- uncertain Resend outcome does not create new attempt.

---

# 49. Tests — reminders

Cover:

- org automation disabled;
- customer opt-out;
- invoice opt-out;
- before-due;
- due-day;
- overdue;
- partial payment uses remaining balance;
- paid/cancelled/voided skip;
- multiple missed steps send latest applicable only;
- stale pre-due step skipped;
- duplicate cron no duplicate reminder;
- provider uncertain no new attempt;
- template variables;
- unknown variable rejected;
- HTML escaping;
- Activity timeline entry.

---

# 50. Tests — cron executor

Cover:

- missing/invalid CRON_SECRET;
- valid authorization;
- safe summary;
- stale job reclaim;
- concurrent claims;
- max attempts;
- needs-attention transition;
- tenant-safe processing;
- no PII in response.

---

# 51. Web tests

Cover:

- recurring list states;
- create schedule;
- next-date preview;
- pause/resume/end;
- responsive recurring list;
- reminder settings disabled/default;
- enable + suggested steps;
- add/edit/delete step;
- template preview;
- customer opt-out;
- invoice opt-out;
- scheduled-send flow;
- invoice detail scheduled state;
- viewer read-only.

Prefer behavior/semantics over class assertions.

---

# 52. Browser QA

Use browser/computer-use at:

- 1440
- 1280
- 768
- 390

Required flows:

1. Create monthly recurring invoice.
2. Verify next invoice/due date preview.
3. Save schedule.
4. Pause.
5. Resume and verify no catch-up surprise.
6. Enable payment reminders.
7. Edit reminder step.
8. Disable reminders for a customer.
9. Disable reminders for one invoice.
10. Schedule draft invoice for future send.
11. Cancel/change scheduled send.
12. Inspect generated invoice/activity.
13. Viewer mode.

Check no overflow, mobile list quality, clear recurrence language, and confirmation for terminal actions.

---

# 53. Documentation

Update:

- docs/database-schema.md
- docs/api-contracts.md
- docs/status-rules.md
- docs/rbac-matrix.md
- docs/deployment-plan.md
- docs/deployment-runbook.md
- docs/release-checklist.md
- .env.example
- docs/codex-task-board.md

Document explicitly:

- Africa/Lagos date semantics;
- daily cadence;
- recurrence anchor/clamping;
- resume skips missed cycles;
- reminder suppression rule;
- payment-aware eligibility;
- job lease/idempotency;
- CRON_SECRET;
- failure/recovery.

---

# 54. Validation

Run:

    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm build

Also run relevant API coverage, real-Postgres concurrency tests, E2E where supported, and git diff --check.

Do not claim live cron verification unless actually deployed/configured.

---

# 55. Deployment smoke test

Where environment access exists:

1. apply migrations;
2. configure CRON_SECRET;
3. verify Vercel cron registered;
4. create test recurring schedule due today;
5. invoke executor;
6. verify exactly one invoice;
7. invoke again;
8. verify no duplicate;
9. create overdue test invoice with reminder due;
10. invoke executor;
11. verify one reminder communication;
12. replay executor;
13. verify no duplicate reminder;
14. inspect invoice Activity;
15. confirm logs/response contain no PII/secrets.

If unavailable from CI, mark it as required manual release QA.

---

# 56. PR requirements

Branch:

feat/t022-recurring-reminder-automation

Suggested title:

T022: Add recurring billing and reminder automation

PR description must include:

- recurring semantics;
- recurrence edge cases;
- automation job model;
- cron integration;
- CRON_SECRET;
- reminder defaults;
- T021/Resend reuse;
- scheduled-send behavior;
- partial-payment behavior;
- idempotency/concurrency;
- RBAC/tenant isolation;
- migrations;
- tests/browser QA;
- live cron smoke-test status;
- known limitations.

---

# 57. Scope exclusions

Do NOT add:

- Customer 360;
- customer portal;
- collections workspace;
- promise-to-pay;
- disputes;
- WhatsApp;
- SMS;
- AI reminders;
- cash forecasting;
- credit scoring;
- direct debit/autopay;
- arbitrary workflow builder;
- arbitrary cron expressions;
- per-organisation timezones;
- worker microservice;
- Redis.

Those are later tasks.

---

# 58. Completion standard

## Story A — recurring billing

    Create monthly recurring schedule
    → define template + due terms
    → enable automatic delivery
    → daily executor reaches next issue date
    → exactly one normal invoice is generated
    → invoice is issued
    → T021 email delivery sends it
    → delivery appears in invoice Activity
    → next occurrence advances without date drift
    → pause/resume/end works safely

## Story B — payment reminders

    Owner enables default reminder sequence
    → sent invoice approaches due date
    → daily executor chooses the correct step
    → current balance is rechecked
    → exactly one reminder communication is created
    → Resend delivery/webhook state is tracked
    → invoice Activity shows the reminder
    → partial payment changes future reminder amount
    → full payment suppresses future reminders
    → customer/invoice opt-out suppresses future reminders

No duplicate invoice. No duplicate email. No background timer. No guessed financial state.

Proceed with implementation now.
