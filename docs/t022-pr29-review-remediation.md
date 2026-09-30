# T022 PR29 Review Remediation

## Scope

This record covers the principal engineer findings for PR29 at commit `855eaf2f03d32c427e545115e781f199941d95b2`. The repair keeps the Postgres job ledger, the daily Vercel trigger, and the T021 communication service. It does not change payment truth or add a second email system.

## Finding Dispositions

| Findings | Change | Evidence |
| --- | --- | --- |
| Non-atomic recurring generation; duplicate invoices | Commit the invoice, items, status event, occurrence link, next date, and audit in one transaction. Lock the occurrence. Migration `0020` adds a unique invoice link. | Real Postgres failure tests after invoice, items, status event, and occurrence writes. Retry uses one invoice and one number. |
| Oversized email keys; invalid actor fallback | Use a deterministic bounded key for long job identities. Keep the logical key in the ledger. Use a nullable user actor. | Real communication persistence for scheduled sends, recurring sends, and reminders. |
| Unfenced leases; cancellation and pause races | Require the current claim token at business mutations and outcomes. Lock jobs before their resources. Recheck current automation intent. | Stale-worker and cancellation tests. |
| Cancelled jobs block the same date | Reactivate the same cancelled logical job and clear retry fields. Refresh reminder payloads after step replacement. | Same-date resume/reschedule and reminder replacement tests. |
| Provider uncertainty and worker failure | Reserve sending before the provider call. An expired reservation requires attention. Preserve the communication and its request snapshot for recovery. | Accepted, uncertain, retry-window, and repeated-run tests. |
| One 25-job batch; unbounded discovery | Drain up to eight batches within the processing budget. Stop discovery at half of the 60-second budget. Skip reminder keys that already have runnable or terminal jobs. Report backlog and budget exhaustion. | Batch/backlog tests. |
| Weak or missing cron secret | Require at least 32 non-placeholder characters in Preview and Production. Limit deployed provider requests to 30 seconds. Allow 120 seconds for the API function. | Environment validation tests and the Vercel API project timeout setting. |
| Non-transactional schedule and reminder replacement | Commit resource changes, item/step replacement, job cancellation, and audit together. | Real Postgres replacement failures keep the original data. |
| Weak update, totals, and date validation | Use shared line normalization and invoice totals for create/update/generation. Reject impossible dates, excess precision, invalid amounts, and empty items. | DTO, date, amount, and persistence tests. |
| Missing automated transition history | Use the same transactional transition function for user and system actors. Cancel pending/running scheduled jobs when a user sends manually. | Real manual-send supersession and automated event tests. |
| First invoice number is zero | Use one shared sequence function for manual and recurring creation. | First recurring invoice is `INV-000001`; failed transactions do not consume it. |
| First reminder setup; Add reminder; RBAC | Show suggested steps for a fresh workspace. Keep an editable draft until save succeeds. Add a step through the editor. Keep read access and mutation permissions consistent. | Reminder UI and API tests. |
| Recurring detail; history links; automation state | Show the customer, schedule details, generated invoice links, delivery states, and actual job states. Keep the view usable after a failed action. | Recurring detail tests. |
| Reminder and invoice automation presentation | Use Lumina controls, status styles, error states, confirmations, and scheduling context. | UI interaction tests and browser checks. |
| Fixed start date; kobo input; missing item controls | Use the Lagos business date. Accept naira values and convert at the API boundary. Support item removal and required recipient edits. | Form tests for amounts, dates, items, and recipients. |
| Mobile layout | Test real Next pages at 375, 768, 1024, and 1440 pixels with isolated API fixtures. Keep screenshots separate from provider evidence. | Browser results are recorded below. |
| New-code duplication | Share invoice sequence, totals, transitions, job reset values, and provider submission/persistence. Use mapped update DTOs to retain the create validators without copying them. Do not suppress or exclude code from the quality gate. | A new SonarCloud analysis is required. The last analysis covers the original reviewed commit, not these changes. |

## Independent Review

- CR-001: A revived reminder kept a deleted step ID. The reset now stores the current step ID, timing, and scheduled date. A real persistence test covers replacement and repeated execution.
- CR-002: A customer lock could deadlock with manual invoice numbering and a foreign-key check. Eligibility reads use `FOR NO KEY UPDATE`; they still block archive edits.
- CR-003: Discovery and long provider timeouts could exceed the function duration. Discovery has a separate deadline. Deployed provider requests have a 30-second limit.
- CR-004: A recovered recurring send could use a cached invoice after cancellation. The send reservation locks and checks the current invoice before it permits delivery.

## Validation

- Workspace lint, typecheck, and build passed.
- The workspace suites passed: API 410, web 224, marketing 30, shared 7. The eight new HTTP validation cases also passed. Total: 679 tests.
- The final DTO and HTTP subset passed all 16 cases after the mapped update DTO change.
- Browser QA passed all 24 checks at 375, 768, 1024, and 1440 pixels. These checks use real Next pages and isolated API fixtures.
- Independent review found no remaining P0, P1, or P2 source finding after the fixes.
- Screenshots: [mobile recurring form](lumina-v2/pr29-qa/recurring-form-mobile.png), [desktop reminders](lumina-v2/pr29-qa/reminders-desktop.png), [desktop recurring detail](lumina-v2/pr29-qa/recurring-detail-desktop.png).
- GitHub CI and all three Vercel deployments passed for code commit `6ba97e9`. The PR records the checks for the final documentation commit.
- SonarCloud still reports the 22 September analysis for `855eaf2f`. It has not produced a check for the repaired commits. The last analysis reports 4.0% new-code duplication against a 3% limit. This stale result cannot confirm the repair. A check rerun request returned `404`; no local Sonar credential is available.

## Isolated Preview Smoke Test

The API deployment for `6ba97e9` passed the test on 30 September. The branch uses only the database `lumina_pr29_review_20260930`, migrated through `0020`. The fixture has a disabled payment account record for the onboarding guard. It makes no payment provider call.

- `/health` and `/health/ready` returned `200`; readiness checked the database.
- The executor rejected missing and incorrect cron credentials with `401`.
- A recurring schedule created one invoice with one line item and number `INV-000001`.
- A second run claimed no jobs. It kept the same occurrence and invoice.
- A scheduled send issued the invoice and reported `needs_attention` because email is not configured. It did not report delivery success.
- A due reminder also reported `needs_attention`. Repeated runs did not retry either job or create a communication.

## Live Environment Limits

The Preview API has a cron secret, but its Vercel environment does not have the Resend variables. Production has email configuration. On 30 September 2026, the Production API returned `200` for `/health`, but `404` for `/health/ready` and `/internal/automation/run`. It runs an earlier release and cannot execute T022.

The user permits testing in Production. This repair does not promote unmerged PR code to Production. Live provider acceptance for scheduled email and reminder email, and safe repeat runs after acceptance, remain required before merge. The isolated Preview test covers generation and the missing-provider state. Local real-Postgres tests and browser API fixtures do not replace the live email test.

## Rollout

Apply migrations through `0020` to the target database. Configure a distinct strong cron secret for each environment. Configure a verified sender, Resend key, and the signing secret for that environment's webhook. Preview cron requires a manual invocation; Vercel schedules only Production cron jobs. See the [Vercel cron documentation](https://vercel.com/docs/cron-jobs).

For a rollback, use the previous deployment. Keep the unique occurrence link: it protects existing data. Inspect any job in `sending` or `needs_attention` before recovery. Do not reset an uncertain send to pending without provider evidence.
