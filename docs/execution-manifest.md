# Execution Manifest

## Shared Context

- Work brief: `docs/platform-experience-hardening-brief.md`
- Accepted plan: `docs/platform-experience-hardening-plan.md`
- Lavish artifact: `.lavish/platform-experience-hardening-plan.html`
- Adversarial review: resolved in the accepted plan; seed safety, test diagnosis, E2E lifecycle, configuration matrix, dashboard priority, GSAP lifecycle, marketing truth, onboarding brand, and checkpoint controls are mandatory.
- Simplicity review: resolved in the accepted plan; keep app-local motion helpers, conditional `ScrollTrigger`, focused viewport checks, one README pass, and no broad cleanup.
- Repository instructions: root `AGENTS.md` plus the committed brief and plan.
- Worktree: `C:\Users\ASUS\Desktop\projects\SME-invoicing\.forest\worktrees\codex\platform-experience-hardening`
- Implementation worker: `terra_xhigh` (`gpt-5.6-terra`, xhigh reasoning).

## Execution Status

- API, web, and marketing implementation is complete.
- Full lint, typecheck, test, and build gates pass.
- The real-stack E2E runner passes desktop, Chromium mobile, and reduced-motion projects; it runs the guarded seed twice and drops its unique database during teardown.
- Final Impeccable detector reports no flagged UI patterns.
- Ponytail review accepted one simplification: the connected payment rail now writes its native transform directly instead of using React state plus a GSAP `set` loop.

## Shared Rules

- Every worker must invoke Ponytail Full before editing and confirm it.
- Workers are not alone in the codebase. Do not revert another worker's edits. Adjust only within the owned files and report conflicts.
- Do not edit `pnpm-lock.yaml`, root `package.json`, `README.md`, `.github/workflows`, or shared package contracts in Wave 1.
- Preserve organisation isolation, roles, provider-confirmed financial truth, public-token redaction, audit behavior, and reduced-motion fallbacks.
- Use ADS-STE100 Simplified Technical English in changed documentation.
- Start with focused tests where practical. Return changed files, tests, assumptions, blockers, and integration notes.

## Task API-01 — Setup, seed safety, and throttle reliability

### Dependencies

None. This task owns API-local behavior and tests.

### Owned Files

- `apps/api/src/config/load-root-env.ts` and configuration tests.
- `apps/api/src/app.module.ts`.
- `apps/api/drizzle.config.ts` and `apps/api/drizzle.test.config.ts`.
- `apps/api/src/database/seed.ts` and seed tests.
- `apps/api/src/scripts/backfill-receipts.ts` and `apps/api/src/scripts/reconcile-invoices.ts`.
- `apps/api/package.json`.
- `apps/api/jest.config.cjs`.
- `apps/api/src/modules/auth/auth.controller.spec.ts`.
- `apps/api/src/modules/public-waitlist/public-waitlist.controller.spec.ts`.
- New API config/seed/rate-limit tests under `apps/api/src`.

### Objective

Make documented root environment loading work, make demo seed data scoped and repeat-stable, and diagnose/fix full-suite throttle-test contention without a timeout mask.

### Acceptance Criteria

- Root and API working-directory source/compiled command matrix passes with missing-file and process-variable precedence cases.
- Production or missing explicit demo opt-in fails before writes; only the fixed demo organisation is touched.
- Two seed runs preserve demo receipt IDs, public tokens, sequence values, audit counts, and a non-demo sentinel organisation.
- Receipt generation uses the existing service path inside the scoped transaction and does not scan unrelated organisations.
- Candidate Jest modes are measured with CI-like metrics; selected policy passes five consecutive full API runs without a timeout increase.
- API package tests pass.

### Validation

- Focused API tests, `--detectOpenHandles` only on a failing mode, and the plan's root migration/seed commands.

## Task WEB-01 — Product identity, accessibility, and responsive dashboard

### Dependencies

None for implementation. Coordinate only on the final shared lockfile and root documentation with the orchestrator.

### Owned Files

- `apps/web/src/components/brand/brand-logo.tsx` and its test.
- `apps/web/src/app/layout.tsx` and `apps/web/src/app/page.tsx`.
- `apps/web/src/features/auth/auth-card.tsx`.
- `apps/web/src/components/layout/sidebar.tsx` and `apps/web/src/components/layout/app-shell.tsx`.
- `apps/web/src/features/public-invoices/public-invoice-page.tsx` and test.
- `apps/web/src/features/receipts/public-receipt-page.tsx` and test.
- `apps/web/src/features/onboarding/business/page.tsx` and onboarding progress test/surface as needed.
- `apps/web/src/features/invoices/invoice-form-page.tsx` and tests.
- `apps/web/src/features/dashboard/dashboard-shell.tsx` and focused tests.
- Related web CSS only when required for these changes.
- `apps/web/package.json` for GSAP only; do not edit the lockfile.

### Objective

Restore Lumina continuity, label invoice controls, remove measured mobile overflow and CTA occlusion, define the existing-data attention matrix, and add small causal GSAP motion with complete static fallback.

### Acceptance Criteria

- No user-visible old brand string or `SI` mark remains on covered product surfaces.
- Line-item quantity and unit-price controls have unique row-aware accessible names after add/remove.
- Dashboard has no horizontal overflow at 375 CSS pixels and create action does not cover status content.
- Attention order follows the accepted setup, review, overdue, pending, current-position matrix and uses no new business rule.
- GSAP is client-only, cleaned up on Strict Mode/remount/route changes, and creates no timeline or trigger under reduced motion.
- Web tests and typecheck pass.

### Validation

- Focused web tests, reduced-motion tests, keyboard checks, and 375/1440 browser checks after integration.

## Task MKT-01 — Marketing GSAP migration and truthful product proof

### Dependencies

None for implementation. Coordinate only on the final shared lockfile and root documentation with the orchestrator.

### Owned Files

- `apps/marketing/src/components/hero/payment-trail-visual.tsx` and tests.
- `apps/marketing/src/components/layout/marketing-header.tsx` and tests.
- `apps/marketing/src/components/sections/connected-payment-trail.tsx` and tests.
- `apps/marketing/src/components/sections/outcome-explorer.tsx` and tests.
- `apps/marketing/src/components/sections/operations-field.tsx` and relevant tests.
- `apps/marketing/src/content/site-copy.ts` and content/SEO tests.
- `apps/marketing/src/lib/seo.ts` only if required for approved claims.
- Delete `apps/marketing/src/lib/motion-features.ts` after migration.
- `apps/marketing/package.json` for GSAP and removal of Motion; do not edit the lockfile.

### Objective

Migrate existing marketing motion to GSAP, retain keyboard and reduced-motion behavior, and make the invoice-to-receipt demonstration consistent and clearly illustrative.

### Acceptance Criteria

- No `motion/react` imports or Motion dependency remains in marketing.
- GSAP is registered only on the client, contexts revert on cleanup, and reduced motion creates no timeline or trigger.
- `ScrollTrigger` is used only if focused parity testing proves continuous progress is needed; otherwise use the smallest GSAP/native scroll signal.
- Demo identifiers and amounts are internally consistent and marked `Illustrative demo data`.
- Typed approved-copy source and rendered-copy/structured-data deny-list reject settlement guarantees, invented proof, unsupported metrics, and customer claims.
- Existing menu, tabs, accordion, focus, and SEO tests pass.

### Validation

- Focused marketing tests, typecheck, and reduced-motion lifecycle checks.

## Wave 2 — Orchestrator-owned integration

After API-01, WEB-01, and MKT-01 complete, the orchestrator owns:

- `pnpm-lock.yaml`, root `package.json`, `.gitignore`, and one final `README.md` documentation pass.
- Minimal guarded E2E runner and Playwright scenario under `e2e/`, including unique database lifecycle, build-time URLs, health checks, logs, teardown, and two repeat runs.
- Any cross-app GSAP dependency reconciliation.
- Final Impeccable detector run after UI files are final.
- Integrated lint, typecheck, tests, build, real-browser checks, Ponytail review, code review, PR creation, and monitoring.
