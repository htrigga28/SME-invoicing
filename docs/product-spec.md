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

MVP reconciliation means matching successful Paystack payment references to invoices and clearly showing whether invoices are paid, partially paid, unpaid, failed, or overdue. It is not real bank statement reconciliation.

## Non-Goals

- Full accounting system.
- Tax filing.
- Payroll.
- Inventory management.
- Real bank statement reconciliation.
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
-> customer creation
-> invoice creation
-> public invoice link
-> payment initialization
-> Paystack webhook
-> invoice status update
-> receipt
-> dashboard/export
```

## Registration and Onboarding

Direct public registration must create the user, organisation/workspace, Owner membership, and blank business profile in one database transaction.

New users with incomplete business profile setup should be directed to onboarding. Dashboard access should remain blocked until the business profile is complete.

Completing the business profile:

- Updates `business_profiles`.
- Sets `business_profiles.setup_completed_at`.
- Sets `organisations.onboarding_completed_at`.
- Writes an audit log entry.

Invite-based registration follows a different path: the user accepts an invitation and joins an existing organisation. Invited users must not create a new organisation during invite acceptance.

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
- Email delivery can be deferred; invite and receipt flows can initially expose generated links or local/dev-safe output.
- The MVP optimizes for a complete demoable workflow over broad accounting features.
