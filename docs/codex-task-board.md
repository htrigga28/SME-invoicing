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
| T002 Repository and tooling foundation | In Review | `task/T002-repo-tooling` | [#1](https://github.com/htrigga28/SME-invoicing/pull/1) | Initialize monorepo tooling, package manager scripts, formatting, linting, typechecking, testing, and base CI. | Monorepo, frontend/API shells, shared package, validation scripts, CI, and README are in place; validation passes. |
| T003 Auth, automatic organisation creation, RBAC foundation, and business onboarding | Not Started | `task/T003-auth-onboarding` | TBD | Implement registration, login, automatic organisation/workspace creation, owner membership, RBAC foundation, and business profile onboarding. | A new owner can register, receive an organisation, complete a business profile, and access protected app routes. |
| T004 Team invitations and member management | Not Started | `task/T004-team-invitations` | TBD | Add organisation invitations, member list, role assignment, and member removal flows. | Owners/admins can invite and manage team members according to RBAC rules. |
| T005 Customer management | Not Started | `task/T005-customer-management` | TBD | Build customer create, list, detail, edit, and archive flows within an organisation. | Users can manage customers with tenant isolation and validation. |
| T006 Invoice core | Not Started | `task/T006-invoice-core` | TBD | Implement invoice creation, line items, invoice details, status rules, totals, and audit events. | Users can create and view invoices with correct totals and status behavior. |
| T007 Public invoice page | Not Started | `task/T007-public-invoice-page` | TBD | Add public invoice link/page showing business, customer, line items, totals, status, and payment call to action. | Customers can view a public invoice without accessing private app data. |
| T008 Paystack payment initialization | Not Started | `task/T008-paystack-initialization` | TBD | Initialize Paystack test payments from public invoice pages and store pending payment records. | Customers can start a test payment and receive a valid Paystack checkout flow. |
| T009 Paystack webhook processing | Not Started | `task/T009-paystack-webhooks` | TBD | Verify Paystack webhook signatures, process payment events idempotently, update payment records, and update invoice statuses. | Successful Paystack events safely reconcile to invoices without duplicate processing. |
| T010 Payments and reconciliation page | Not Started | `task/T010-reconciliation-page` | TBD | Build internal payments and reconciliation views showing payment references, invoice matches, and reconciliation status. | Users can see paid, partial, unpaid, failed, and overdue states clearly. |
| T011 Receipts | Not Started | `task/T011-receipts` | TBD | Generate and display receipts for successful payments. | Receipts are tied to payments and invoices and can be viewed by authorized users. |
| T012 Dashboard | Not Started | `task/T012-dashboard` | TBD | Build dashboard summaries for invoices, payments, outstanding balances, overdue amounts, collection rate, and recent activity. | Dashboard gives a useful operational view of invoice and payment health. |
| T013 CSV exports and audit logs | Not Started | `task/T013-exports-audit-logs` | TBD | Add CSV exports and audit log views for key records and actions. | Authorized users can export records and review important activity history. |
| T014 Seed data and demo polish | Not Started | `task/T014-seed-demo-polish` | TBD | Add seed data, demo credentials, demo scenarios, and workflow polish. | The full MVP can be demonstrated quickly with realistic Nigerian SME data. |
| T015 Deployment and portfolio documentation | Not Started | `task/T015-deployment-portfolio-docs` | TBD | Prepare deployment configuration, environment documentation, README updates, and portfolio-facing docs. | The project is deployable, documented, and ready to present as a portfolio case study. |

## Task Execution Notes

- Only one task should be in progress at a time unless a follow-up task is explicitly split out.
- Task branches should be deleted after merge.
- Each task should update this board when its status, branch, or PR changes.
- Documentation-only tasks should not create application code.
- Implementation tasks should include validation results in the PR.
- T001 was patched for auth/session storage, RBAC, invoice payment, active organisation handling, and schema clarity before implementation.
