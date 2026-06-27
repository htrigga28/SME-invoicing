# Testing Strategy

Testing should focus on business rules, tenant isolation, RBAC, and payment safety before broad UI polish.

## Backend Unit and Integration Tests

Required coverage:

- Auth registration transaction.
- Automatic organisation creation.
- Owner membership creation.
- Blank business profile creation.
- Duplicate email rejection.
- Login success/failure.
- Refresh token rotation and revocation.
- Business profile completion.
- RBAC.
- Tenant isolation.
- Customer access scoping.
- Invoice total calculation.
- Invoice number generation.
- Invoice status transitions.
- Overdue calculation.
- Partial payment calculation.
- Paystack webhook signature verification.
- Webhook idempotency.
- Duplicate payment reference handling.
- Receipt generation.
- CSV export filters.

## Backend Test Notes

- Registration tests should assert user, organisation, membership, and business profile are committed together or rolled back together.
- Tenant tests should create at least two organisations and prove data cannot cross boundaries.
- RBAC tests should cover Owner, Admin, Accountant, and Viewer for key mutations.
- Webhook tests should use raw request bodies and known test signatures.
- Payment tests should assert duplicate references do not double-count invoice totals.
- Invoice total tests should prove frontend-provided totals are ignored or validated against server calculations.

## Frontend Tests

Required coverage:

- Register form validation.
- Login form validation.
- Business onboarding form.
- Customer form validation.
- Invoice form line-item display.
- Invoice table loading/empty/error states.
- Public invoice invalid token state.
- Payment initialization error state.

## Frontend Test Notes

- Form tests should validate required fields and disabled submit states.
- Table tests should cover loading, empty, error, and populated states.
- Public invoice tests should prove invalid tokens show a safe customer-facing error.
- Role-based UI tests should confirm restricted actions are hidden or disabled, but backend tests remain the source of truth.

## Playwright E2E Demo Flow

The main E2E scenario should cover:

1. Register or login as demo owner.
2. Complete business profile.
3. Create customer.
4. Create invoice.
5. Open public invoice.
6. Initialize test payment.
7. Simulate Paystack webhook.
8. Verify invoice becomes paid.
9. View receipt.
10. Export invoices.
11. Verify Viewer cannot mutate data.

## Validation Commands

Once tooling exists, every PR should attempt:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If a command is unavailable, the PR must state why. During T001, these commands are expected to be unavailable because application tooling has not been scaffolded yet.

## Test Data Strategy

- Use deterministic seed factories.
- Avoid external network calls in automated tests.
- Mock Paystack API calls except in explicit manual test mode.
- Store webhook fixtures with redacted data.
- Use transaction rollback or isolated test databases for backend integration tests.
