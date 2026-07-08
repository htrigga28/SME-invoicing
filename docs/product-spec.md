# Product Spec

## Positioning

SME Invoice & Payment Reconciliation Platform is a lightweight invoice, payment tracking, and reconciliation workspace for Nigerian SMEs, freelancers, agencies, and service providers.

The user-facing concept is the business profile. The internal technical tenant is the organisation/workspace. During normal public registration, the user does not manually create an organisation. The system creates the organisation/workspace automatically and lets the user complete the business profile.

## MVP Scope

The MVP includes:

- Direct user registration.
- Automatic organisation/workspace creation during registration.
- Owner membership creation.
- Business profile onboarding.
- Payment Setup with Paystack bank resolution and subaccount creation.
- Customer management.
- Invoice creation with line items.
- Public invoice payment page.
- Paystack test payment initialization.
- Paystack webhook processing.
- Payment records.
- Invoice status updates.
- Receipt generation.
- Dashboard summary.
- CSV export.
- Audit logs.
- Seed data.
- Demo credentials.

MVP reconciliation means matching Paystack payment references to invoices, deriving invoice financial state from successful payments minus processed refunds, showing whether invoices are paid, partially paid, unpaid, failed, overdue, or overpaid, and surfacing true issues that need review. It is not real bank statement reconciliation.

MVP receipts are immutable proof-of-payment records generated from successful provider-confirmed payments. Refund information is displayed as a derived summary from processed refund records; the original receipt amount is not rewritten.

MVP exports are synchronous CSV downloads for organisation-scoped customers, invoices, payments, receipts, and Owner/Admin audit logs. Exported data must remain operationally useful without exposing public tokens, provider subaccount codes, raw provider payloads, full account numbers, or auth/token secrets. CSV cells are protected against spreadsheet formula injection, and successful exports create one safe audit event.

MVP audit logs are append-only operational history. Owner/Admin users can browse and filter audit events and inspect safe metadata summaries. The UI and API must not expose arbitrary raw metadata JSON.

## Non-Goals

- Full accounting system.
- Tax filing.
- Payroll.
- Inventory management.
- Real bank statement reconciliation.
- Customer wallets, credit balances, and general ledger accounting.
- Broad refund-management or chargeback-management workflows beyond overpayment excess refunds.
- Multi-currency accounting beyond NGN.
- Credit scoring.
- Loan applications.
- Complex team/organisation switching in MVP.
- Production-grade email reminder automation in MVP.

## User Types

| User type | Description |
| --- | --- |
| Owner | Created during direct registration. Has full access to the organisation/workspace. |
| Admin | Manages business operations but cannot transfer ownership. |
| Accountant | Manages customers, invoices, payments, receipts, and exports. |
| Viewer | Read-only internal user. |
| Customer | Pays an invoice through a public link without a platform account. |

## Main Product Flow

```text
register
-> organisation auto-created
-> owner membership created
-> blank business profile created
-> business profile setup
-> dashboard available
-> payment setup
-> customer creation
-> invoice creation
-> public invoice link
-> payment initialization
-> Paystack webhook
-> invoice status update
-> overpayment review/refund if needed
-> receipt
-> dashboard/export
```

Real-world payment model:

```text
business profile complete
-> business opens Payment Setup
-> business selects bank
-> business enters account number
-> backend resolves account name through Paystack
-> user confirms resolved account name
-> backend re-resolves account number
-> backend creates Paystack subaccount
-> provider_subaccount_code and masked bank details stored
-> payment account marked active or verification_delayed
-> invoice payments use organisation Paystack subaccount
```

## Registration and Onboarding

Direct public registration must create the user, organisation/workspace, Owner membership, and blank business profile in one database transaction.

New users with incomplete business profile setup should be directed to onboarding. Dashboard access should remain blocked until the business profile is complete.

After business profile completion:

- Dashboard access becomes available.
- Payment Setup must be highlighted as required before accepting online payments.
- Customer and invoice creation can continue before Payment Setup is complete.
- Sending and sharing invoices can continue before Payment Setup is complete if desired.
- Public invoice viewing remains available without Payment Setup.
- Public invoice payment initialization must be blocked until an active payment account exists.

Completing the business profile:

- Updates `business_profiles`.
- Sets `business_profiles.setup_completed_at`.
- Sets `organisations.onboarding_completed_at`.
- Writes an audit log entry.

Invite-based registration follows a different path: the user accepts an invitation and joins an existing organisation. Invited users must not create a new organisation during invite acceptance.

## Payment Setup

Payment Setup is MVP-critical for any organisation that wants to accept online payments.

Required MVP Payment Setup flow:

- Owner/Admin opens Payment Setup after business profile completion.
- User selects a Nigerian bank and enters an account number.
- Backend resolves the bank account name through Paystack.
- User explicitly confirms the resolved account name.
- Backend re-resolves the account before activation or subaccount creation.
- Backend creates a Paystack subaccount through the platform integration.
- The product stores `provider_subaccount_code` plus masked bank details only.
- The payment account becomes `active` or `verification_delayed` depending on provider/business rules.
- Public invoice payment initialization uses the active organisation subaccount.

Business and platform rules:

- The platform does not hold funds.
- The platform does not provide wallet balances.
- The platform does not store merchant Paystack secret keys.
- The platform uses one platform Paystack integration and organisation-level Paystack subaccounts.
- Each organisation must configure a valid payout account before accepting public invoice payments.
- Bank account name must be resolved and confirmed before activation.
- Paystack settlement timing is controlled by Paystack.
- Paystack fee behavior and bearer configuration must be explicit at payment initialization time.
- Changing payout account may trigger `verification_delayed` or provider review delay.
- Starter versus registered business limits and compliance requirements may apply depending on Paystack rules.

## Active Organisation Handling

If a user has one active membership, the backend should use that organisation/workspace as active automatically. If a user has multiple active memberships, the backend should support explicit active organisation selection, but complex organisation switching UI is deferred from the MVP.

Protected resource operations must never infer organisation from a frontend-provided `organisationId`. The backend must derive access from the authenticated user's active membership.

## Recommended Stack

| Area | Choice |
| --- | --- |
| Frontend | Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | NestJS, TypeScript |
| Database | PostgreSQL |
| ORM | Drizzle |
| Payments | Paystack test mode |
| Email | Brevo later |
| File storage | Cloudflare R2 later |
| Testing | Jest/Vitest, Supertest, Playwright where useful |
| Monorepo | pnpm workspaces and Turborepo |

## Assumptions

- NGN is the only MVP currency.
- Money is stored as integer kobo.
- Paystack is used in test mode for portfolio demonstration.
- Public invoice viewing can work without Payment Setup, but accepting online payment requires an active payment account.
- Email delivery can be deferred; invite and receipt flows can initially expose generated links or local/dev-safe output.
- The MVP optimizes for a complete demoable workflow over broad accounting features.
