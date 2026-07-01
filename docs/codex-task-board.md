# Codex Task Board

This board tracks the planned milestone execution for the SME Invoice & Payment Reconciliation Platform. Each task should be completed on its own branch and reviewed through a pull request into `main`.

Status values:

- Not Started
- In Progress
- In Review
- Done

| Task | Status | Branch | PR | Scope summary | Acceptance summary |
| --- | --- | --- | --- | --- | --- |
| T000 Git strategy and project governance | Done | `task/T000-git-strategy` | TBD | Create Git workflow, Codex task board, PR review checklist, and pull request template. | Governance docs exist, workflow is clear, and no application code is created. |
| T001 Product and technical planning docs | In Review | `task/T001-planning-docs` | TBD | Define MVP product scope, technical planning, database shape, API contracts, webhook behavior, tests, deployment, and demo plan. | Planning docs are patched for auth/session, RBAC, invoice payment, active organisation handling, and schema clarity. |
| T002 Repository and tooling foundation | Done | `task/T002-repo-tooling` | [#1](https://github.com/htrigga28/SME-invoicing/pull/1) | Initialize monorepo tooling, package manager scripts, formatting, linting, typechecking, testing, and base CI. | Monorepo, frontend/API shells, shared package, validation scripts, CI, and README are in place; validation passes. |
| T003 Auth, automatic organisation creation, RBAC foundation, and business onboarding | Done | `task/T003-auth-onboarding` | [#2](https://github.com/htrigga28/SME-invoicing/pull/2) | Implement registration, login, automatic organisation/workspace creation, owner membership, RBAC foundation, and business profile onboarding. | Auth/session foundation, Drizzle tables/migrations, RBAC/tenant guards, and business profile onboarding are implemented; validation passes. |
| T004 Team invitations, member management, and development seed data | Done | `task/T004-team-invitations` | [#3](https://github.com/htrigga28/SME-invoicing/pull/3) | Add organisation invitations, member list, role assignment, member removal flows, and local demo seed data. | Owners/admins can invite and manage team members according to RBAC rules; demo users and invitations are seeded idempotently. |
| T005 Customer management | Done | `task/T005-customer-management` | [#4](https://github.com/htrigga28/SME-invoicing/pull/4) | Build customer create, list, detail, edit, and archive flows within an organisation. | Customer API, UI, seed data, tenant isolation, RBAC, soft archive, duplicate active email rules, docs, and validation are complete. |
| T006 Invoice core | Done | `task/T006-invoice-core` | [#5](https://github.com/htrigga28/SME-invoicing/pull/5) | Implement invoice creation, line items, invoice details, status rules, totals, and audit events. | Users can create, view, edit draft, send, cancel, and void invoices with server-calculated totals, organisation-scoped numbers, and status events. |
| T007 Public invoice page | Done | `task/T007-public-invoice-page` | [#6](https://github.com/htrigga28/SME-invoicing/pull/6) | Add public invoice link/page showing business, customer, line items, totals, status, and payment call to action. | Customers can view a public invoice without accessing private app data. |
| T008 Paystack payment initialization | Done | `task/T008-paystack-initialization` | [#7](https://github.com/htrigga28/SME-invoicing/pull/7) | Initialize Paystack test payments from public invoice pages and store pending payment records. | Customers can start a test payment and receive a valid Paystack checkout flow. |
| T009 Paystack webhook processing | In Review | `task/T009-paystack-webhooks` | [#8](https://github.com/htrigga28/SME-invoicing/pull/8) | Verify Paystack webhook signatures, process payment events idempotently, update payment records, and update invoice statuses. | Successful Paystack events safely reconcile to invoices without duplicate processing. |
| T010 Payment Setup MVP Pivot Documentation | In Review | `task/T010-payment-setup-pivot` | [#10](https://github.com/htrigga28/SME-invoicing/pull/10) | Update planning and product documentation so Payment Setup, Paystack bank resolution, and organisation subaccounts become MVP-critical scope. | Product, API, schema, status, deployment, README, and task-planning docs reflect the Payment Setup pivot without runtime code changes. |
| T011 Organisation Payment Setup and Paystack Subaccounts | Not Started | `task/T011-payment-setup-subaccounts` | TBD | Implement organisation Payment Setup, bank resolution, account confirmation, and Paystack subaccount creation/storage. | Owner/Admin can activate an organisation payment account with masked payout details and stored `provider_subaccount_code`. |
| T012 Patch Invoice Payment Initialization for Subaccounts | Not Started | `task/T012-payment-init-subaccounts` | TBD | Update public invoice payment initialization to require an active payment account and use organisation `provider_subaccount_code`. | Public payment initialization is safely blocked until Payment Setup is active and all initialized payments retain subaccount traceability. |
| T013 Payments and Reconciliation Page | Not Started | `task/T013-reconciliation-page` | TBD | Build internal payments and reconciliation views showing payment references, invoice matches, and reconciliation status. | Users can see paid, partial, unpaid, failed, and overdue states clearly with subaccount-aware payment records. |
| T014 Receipts | Not Started | `task/T014-receipts` | TBD | Generate and display receipts for successful payments. | Receipts are tied to payments and invoices and can be viewed by authorized users after reconciliation flows exist. |
| T015 Dashboard Metrics | Not Started | `task/T015-dashboard-metrics` | TBD | Build dashboard summaries for invoices, payments, outstanding balances, overdue amounts, collection rate, and recent activity. | Dashboard gives a useful operational view of invoice and payment health. |
| T016 Exports and Audit Logs | Not Started | `task/T016-exports-audit-logs` | TBD | Add CSV exports and audit log views for key records and actions. | Authorized users can export records and review important activity history. |
| T017 UI Polish Pass | Not Started | `task/T017-ui-polish` | TBD | Resolve deferred UI consistency issues and improve workflow polish across the MVP. | Shared UI behavior is consistent and deferred polish issues are closed without changing core business rules. |
| T018 Deployment and Portfolio Demo Hardening | Not Started | `task/T018-deployment-demo-hardening` | TBD | Finalize deployment configuration, portfolio-facing docs, demo safety, and launch hardening. | The project is deployable, documented, and safe to present with realistic payment-setup assumptions. |

## Task Execution Notes

- Only one task should be in progress at a time unless a follow-up task is explicitly split out.
- Task branches should be deleted after merge.
- Each task should update this board when its status, branch, or PR changes.
- Documentation-only tasks should not create application code.
- Implementation tasks should include validation results in the PR.
- T001 was patched for auth/session storage, RBAC, invoice payment, active organisation handling, and schema clarity before implementation.
- T004 was patched before T005 to add a reusable authenticated app shell, sidebar navigation, and coming-soon placeholders for future modules.
- T005 was patched before merge to replace native browser prompts with app-level confirmation UI for customer archive actions.
- Payment Setup is now MVP-critical and must land before subaccount-aware payment initialization and reconciliation UI.
- T013 Payments/Reconciliation must happen after T011 and T012 so reconciliation reflects subaccount-aware payment records.
- Receipt generation remains sequenced after reconciliation.
- The unresolved global button/select UI issue is deferred to T017.
