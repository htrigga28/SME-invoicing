# PR Review Checklist

Use this checklist when reviewing every pull request. The goal is to keep task branches small, technically sound, and safe for a multi-tenant invoicing product.

## Scope Control

- [ ] The PR maps to one task ID from `docs/codex-task-board.md`.
- [ ] The PR does not include unrelated files or opportunistic refactors.
- [ ] The implementation matches the stated acceptance criteria.
- [ ] Large follow-up work is documented instead of hidden in the current PR.

## TypeScript Correctness

- [ ] Types are explicit where they protect business logic or API boundaries.
- [ ] No avoidable `any` usage was introduced.
- [ ] Shared types stay consistent between frontend, backend, database, and tests.
- [ ] Error cases are represented clearly instead of being ignored.

## Validation

- [ ] `pnpm lint` was run or marked unavailable with a reason.
- [ ] `pnpm typecheck` was run or marked unavailable with a reason.
- [ ] `pnpm test` was run or marked unavailable with a reason.
- [ ] `pnpm build` was run or marked unavailable with a reason.
- [ ] Validation failures are explained and tracked.

## Tenant Isolation

- [ ] Organisation/workspace IDs are used to scope private data.
- [ ] Users cannot access another organisation's customers, invoices, payments, receipts, exports, or audit logs.
- [ ] Public invoice access exposes only the intended public invoice data.
- [ ] Queries and mutations enforce tenant boundaries on the server side.

## RBAC

- [ ] Owner, admin, accountant, and viewer permissions are respected.
- [ ] Privileged actions are guarded on the server side.
- [ ] UI permissions do not replace backend authorization.
- [ ] Role changes, invitations, and member actions are auditable where relevant.

## Tests

- [ ] Critical business rules have tests.
- [ ] Payment and webhook behavior is covered where changed.
- [ ] Tenant isolation and RBAC paths are tested where changed.
- [ ] UI workflows include tests where useful and practical.
- [ ] Tests use deterministic data and avoid external network dependency unless explicitly mocked.

## UI States

- [ ] Loading states are handled.
- [ ] Empty states are handled.
- [ ] Error states are handled.
- [ ] Success states or confirmations are handled.
- [ ] Disabled submit states prevent duplicate or invalid actions.
- [ ] Form validation is visible and useful.
- [ ] Mobile and desktop layouts remain usable.

## Security

- [ ] Secrets are not committed.
- [ ] Payment setup does not expose Paystack secrets.
- [ ] Payment setup does not store full account numbers after subaccount creation.
- [ ] Payment webhooks verify signatures.
- [ ] Webhook processing is idempotent.
- [ ] User input is validated before persistence.
- [ ] Sensitive data is not exposed in public pages, logs, exports, or errors.
- [ ] Authentication and authorization are enforced server-side.

## Payment Setup Specific Checks

- [ ] Account name confirmation is required before activation.
- [ ] Backend re-resolves the bank account before subaccount creation.
- [ ] Payment initialization derives the subaccount server-side.
- [ ] Masked account details use `account_number_last4` rather than a full account number.
- [ ] `provider_subaccount_code` handling is documented and preserved for payment traceability.

## Documentation

- [ ] Relevant docs are updated when behavior, setup, validation, schema, or workflows change.
- [ ] New environment variables are documented.
- [ ] Known limitations are stated clearly.
- [ ] Demo instructions stay accurate when user-facing flows change.

## No Unrelated Changes

- [ ] Formatting churn is limited to files touched by the task.
- [ ] Generated files are expected and necessary.
- [ ] Dependency changes are justified by the task.
- [ ] Planning docs, product docs, and implementation docs are not changed without task scope.
