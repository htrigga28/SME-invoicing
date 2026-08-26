# Lumina Platform Experience Hardening

## Status

- Type: improvement
- Implementation delegation: always
- Delegation source: user request and repository Kickoff configuration
- Planning worker: `sol_high` (`gpt-5.6-sol`, high reasoning)
- Planning worker source: user request and `docs/kickoff.yaml`
- Review worker: `sol_high` (`gpt-5.6-sol`, high reasoning), in fresh sessions
- Review worker source: user request and `docs/kickoff.yaml`
- Implementation worker: `terra_xhigh` (`gpt-5.6-terra`, xhigh reasoning)
- Implementation worker source: user request and `docs/kickoff.yaml`
- Planning mode: full
- Worktree manager: Forest
- Branch: `codex/platform-experience-hardening`
- Worktree path: `C:\Users\ASUS\Desktop\projects\SME-invoicing\.forest\worktrees\codex\platform-experience-hardening`
- Task workspace: `C:\Users\ASUS\Desktop\projects\SME-invoicing\.forest\worktrees\codex\platform-experience-hardening\docs`
- Created: 2026-08-26
- Target date: no fixed target supplied; completion in one reviewed delivery is feasible if no external service or authentication blocker appears
- Current phase: planning

## Objective

Make Lumina a more useful, coherent, and reliable invoicing experience for Nigerian small businesses. Fix problems found through real end-to-end use, improve the web product and marketing site with focused interaction and information-design changes, add restrained GSAP motion, and remove or avoid unnecessary complexity.

## Context

The repository contains a NestJS API, a Next.js product application, a Next.js marketing application, and shared packages. The existing interface is visually strong and has an established dark graphite, lime signal, Hanken Grotesk, and JetBrains Mono design language. This work is a focused hardening and polish pass, not a redesign.

The baseline test used an isolated PostgreSQL 17 database, the real API, built application behavior, seeded demo data, and browser interactions at desktop and mobile sizes. The primary invoice path was completed: owner sign-in, customer selection, invoice creation, send action, and public invoice view. Viewer authorization was also checked.

## Requirements

1. Repair the documented local setup so a root `.env` works with root database commands.
2. Make the full API test suite reliable without hiding slow or broken behavior behind a broad timeout increase.
3. Remove mobile horizontal overflow from the product dashboard and prevent fixed actions from obscuring important status content.
4. Give invoice quantity and unit-price controls programmatic labels and preserve efficient line-item entry.
5. Use the Lumina name and identity consistently across marketing, authentication, application navigation, and metadata.
6. Improve the dashboard and invoicing journey with clear attention states and action hierarchy. Use established components and product data.
7. Improve marketing communication with product-specific proof through interface demonstrations. Do not add invented claims, customers, certifications, or performance numbers.
8. Add thoughtful GSAP motion in both applications. Motion must explain sequence, state, or causality. It must not delay tasks, animate every element, or ignore reduced-motion preferences.
9. Prefer replacing the existing marketing animation dependency with GSAP over shipping two overlapping motion systems, if repository analysis confirms a clean migration.
10. Keep permissions, organisation isolation, payment truth, audit safety, and public-token behavior unchanged unless a verified defect requires a narrow correction.
11. Apply Ponytail principles: use existing utilities and platform features, delete duplication where it directly supports this delivery, and defer unrelated repository-wide refactors.
12. Keep all technical documentation in ADS-STE100 Simplified Technical English.

## Acceptance Criteria

- A developer can follow the root README setup and run database migration and seed commands with the documented root `.env`.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, and the full `pnpm test` suite pass from the worktree.
- The two rate-limit controller tests pass in the full suite and in isolation. The fix addresses shared-state or scheduling behavior rather than only increasing the global timeout.
- The dashboard has no horizontal document overflow at a 375 CSS-pixel mobile viewport, including long payment references.
- Important dashboard warnings remain readable and reachable when the mobile create-invoice action is present.
- Each invoice line-item quantity and unit-price input has a unique accessible name.
- Marketing and product surfaces use the Lumina identity consistently.
- Owner invoice creation, send, public invoice view, payments, receipts, and owner-only team access pass in a real browser against the local API and database.
- A viewer receives a clear access-denied state for owner-only team settings.
- GSAP motion appears in purposeful places in both marketing and product applications. `prefers-reduced-motion: reduce` yields a complete, stable, and usable static experience.
- Marketing outcome demonstrations and product attention states remain understandable without animation.
- Changed interfaces pass the Impeccable detector once after implementation and receive responsive visual checks.
- No new unneeded general-purpose abstraction or overlapping animation dependency remains.

## Evidence And Sources

### Repository and command evidence

- `pnpm install --frozen-lockfile`: passed.
- `pnpm lint`: passed for all six tasks.
- `pnpm typecheck`: passed for all six tasks.
- `pnpm build`: passed for all five packages. Next.js reported a worktree-only lockfile-root warning.
- `pnpm test`: shared, marketing, and web passed. API had 158 passing tests and two timeouts in the full parallel run.
- The timed-out tests were the public registration throttle test and public waitlist per-client limit test. Both passed when run together with `--runInBand`, which points to full-suite contention or leaked shared state.
- `pnpm db:migrate` failed with `DATABASE_URL is required for Drizzle commands` after `.env.example` was copied to the documented root `.env`. Explicit environment injection made migration and seed pass.
- The README asks the developer to create the root `.env`, then run root database commands. The API Drizzle process does not load that root file.
- Desktop and mobile browser tests covered marketing, sign-in, dashboard, customers, invoices, payments, receipts, exports, audit logs, team, payment setup, invoice create/send/public-view, and viewer denial.
- The mobile dashboard measured 446 pixels of document width in a 361-pixel content viewport. Long payment references contributed to overflow.
- The invoice form exposed quantity and unit-price controls as unnamed spin buttons.
- Seed data contains successful payments, but receipts need a separate documented backfill command. The plan must decide whether the seed flow should produce a useful complete demo or make the required follow-up unmistakable.

### Mobbin product and marketing research

- [Acctual invoice creation](https://mobbin.com/flows/164ea2a9-05d1-44d3-9d7b-61d2afeba6cc): guided first-invoice checklist, split editor and live preview, and a clear ready-to-send handoff.
- [Wave invoice creation](https://mobbin.com/flows/3090046b-80c1-4597-8768-72ab762221ef): one coherent invoice artifact with customer, dates, items, tax, discount, and an explicit draft lifecycle.
- [Xero invoice creation](https://mobbin.com/flows/d181cc9e-49f9-4020-b3ee-f07cb1cc8e0c): progressive invoice composition with a clear review state.
- [Xero receivables](https://mobbin.com/flows/7cffc2b1-19e6-4ab0-a12b-c9875b77f7f0): waiting and overdue work grouped by operational state with payment actions close to invoice details.
- [Mercury invoice detail](https://mobbin.com/flows/684e872d-afc9-41a9-9662-8dd4ff78f955): compact totals, a side detail surface, payment-link access, and an event timeline.
- [Deel Finance](https://mobbin.com/flows/7009c99b-27b2-45ef-b07f-945899e600bc): attention-first cards and actionable pending work.
- [Deel dashboard](https://mobbin.com/screens/d784bbd9-d9ff-4f4b-be16-20eca82fb631), [Bonsai dashboard](https://mobbin.com/screens/34d0f00d-1ca1-4c73-b388-14b96f0b88a9), [Stripe receivables](https://mobbin.com/screens/54ef3db8-2b9e-4ef3-a91a-cad15de1e1c9), [QuickBooks dashboard](https://mobbin.com/screens/a1576a19-53f6-498d-80a7-02ece64072d8), and [Wave dashboard](https://mobbin.com/screens/202a094f-1eef-4462-919f-39b7fd113e05): concise aging, status distribution, and attention patterns.

Use these sources for interaction principles and information hierarchy only. Keep Lumina's identity and do not copy another product's visual brand. Apply the same product clarity to marketing demonstrations so the site shows how Lumina resolves payment ambiguity.

### Ponytail whole-repository audit

- No dead UI component or style export was found.
- Product feature files repeat some page headers, alerts, retry actions, links, date formatting, money formatting, and detail rows.
- API modules repeat some invoice rules that may already exist in `@sme-invoicing/shared`.
- Several API services repeat pagination helpers.
- Several web API modules repeat query-string construction.
- Audit-log insert wrappers repeat work.
- Maintenance scripts manually construct Nest services.
- `packages/config` and `infra` may be unused placeholders.
- The audit estimated that about 730 lines could be removed. Each candidate needs call-site and repository-policy verification. This delivery must not become an unrelated cleanup campaign.

## Decisions

- Use full planning because this work spans product behavior, accessibility, responsive layout, animation architecture, setup, and test reliability.
- Use Forest and keep all work on `codex/platform-experience-hardening`.
- Use `sol_high` for planning and fresh independent plan reviews.
- Use `terra_xhigh` for delegated implementation.
- Use Impeccable for both product and marketing work. Preserve the existing design authority and use the polish playbook.
- Use Ponytail Full during implementation and the whole-repository audit as evidence, not as an automatic refactor list.
- Preserve the existing Red Clay development server on port 3000. Baseline tests use API 4100, product 3100, marketing 3102, and isolated PostgreSQL 55432.
- Keep financial states explicit. Do not turn pending, failed, or abandoned payment attempts into collected revenue.

## Risks

- A broad motion migration can create regressions or bundle cost if it is not bounded to existing animated surfaces.
- Dashboard changes can obscure accounting meaning if visual priority is not tied to verified status data.
- Rate-limit tests can appear fixed when run alone while remaining flaky under full concurrency.
- Root environment loading can accidentally change production configuration if the fix is not limited to development commands.
- Repository-wide simplification can distract from user-facing defects. Only changes with direct delivery value belong in this plan.

## Open Questions

- Should the seed command generate receipts directly, invoke the existing backfill, or keep two commands with clearer setup automation? The plan must select the smallest reliable option.
- Which existing marketing motion surfaces can migrate cleanly to GSAP so the `motion` dependency can be removed?
- Which dashboard attention treatment yields the clearest next action without adding new business rules?

## Plan

The full plan will be written to `docs/platform-experience-hardening-plan.md` and rendered as a Lavish review artifact. Implementation starts only after adversarial and simplicity reviews are resolved and the user approves the reviewed plan.

## Execution Notes

- Baseline browser testing created and sent temporary invoice `INV-000025` in the isolated database.
- The temporary database and development servers are disposable and are not part of the repository deliverable.
