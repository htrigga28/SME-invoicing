# RBAC Matrix

## Roles

| Role | Behaviour |
| --- | --- |
| Owner | Full access. Can manage team, settings, operations, and ownership-sensitive actions. |
| Admin | Can manage business operations but cannot transfer ownership. |
| Accountant | Can manage customers and invoices and can view payments/reconciliation. Later tasks may add receipt/export operations, but Accountant cannot manage team/settings. |
| Viewer | Read-only access. |

Customers paying public invoices do not need a platform account.

## Permission Matrix

| Area | Owner | Admin | Accountant | Viewer |
| --- | --- | --- | --- | --- |
| Business profile view | Yes | Yes | Yes | Yes |
| Business profile update | Yes | Yes | No | No |
| Payment Setup status view | Yes | Yes | Yes | Yes |
| Payment Setup bank list/resolve/create/disable | Yes | Yes | No | No |
| Team invitations | Yes | Limited | No | No |
| Team members view | Yes | Yes | No | View own profile only |
| Team role changes | Yes | Limited, not Owner | No | No |
| Customers view | Yes | Yes | Yes | Yes |
| Customers create/update/archive | Yes | Yes | Yes | No |
| Invoices view | Yes | Yes | Yes | Yes |
| Invoices create/update/send | Yes | Yes | Yes | No |
| Invoices cancel/void | Yes | Yes | No | No |
| Payments view | Yes | Yes | Yes | Yes |
| Payments mutate manually | No | No | No | No |
| Receipts view | Yes | Yes | Yes | Yes |
| Receipts generate/regenerate | Yes | Yes | Yes | No |
| Exports | Yes | Yes | Yes | No |
| Dashboard | Yes | Yes | Yes | Yes |
| Audit logs | Yes | Yes | No | No |
| Settings | Yes | Limited business settings | No | No |

## Invitation Permissions

| Actor | Can invite |
| --- | --- |
| Owner | Admin, Accountant, Viewer |
| Admin | Accountant, Viewer |
| Accountant | Nobody |
| Viewer | Nobody |

Admin cannot invite Owner or transfer ownership.

## Team Management Permissions

| Actor | Can manage |
| --- | --- |
| Owner | Admin, Accountant, Viewer |
| Admin | Accountant, Viewer |
| Accountant | Nobody |
| Viewer | Nobody |

Owner role transfer, Owner removal, and self-removal are out of scope for the MVP.

## Registration and Invitation Rules

- Direct public registration creates a new organisation.
- Invite-based registration joins an existing organisation.
- Invited users must not create a new organisation when accepting an invite.
- Invitation links must use secure unguessable tokens.
- Invitation tokens must be stored as hashes, not raw tokens.
- Invite acceptance must verify the invited email.
- Accepted invite creates an `organisation_members` row.
- Duplicate active membership must be blocked.
- Duplicate pending invitations for the same organisation and email must be blocked.
- Expired, revoked, or accepted invitations cannot be reused.
- A user is not an organisation member until the invitation is accepted.

## Tenant Rules

- Every organisation-scoped table must include `organisation_id`.
- Every protected query must be scoped by the authenticated user's active organisation membership.
- Never trust `organisationId` from the frontend.
- Payment Setup reads and mutations derive organisation scope from the authenticated active membership.
- Payment Setup management is Owner/Admin only; Accountant/Viewer can view status only.
- Payments and reconciliation views are readable in T013 for Owner/Admin/Accountant/Viewer.
- Owner/Admin can initiate Paystack overpayment refund requests from payment detail. Accountant/Viewer remain read-only for refunds.
- Owner/Admin/Accountant can generate customer, invoice, payment, and receipt CSV exports. Only Owner/Admin can export audit logs.
- Only Owner/Admin can browse full audit logs. Accountant operational history should stay entity-specific unless later scoped.
- Customer list, detail, create, update, and archive operations derive organisation scope from the authenticated active membership.
- Customer create, update, and archive are allowed for Owner/Admin/Accountant only; Viewer is read-only.
- Archived customers remain readable but cannot be updated in the MVP.
- The backend should derive active organisation access from the authenticated session and membership.
- Customers, invoices, payments, receipts, exports, audit logs, and dashboard data must be organisation-scoped.
- Public invoice endpoints are scoped by unguessable public token and must expose only customer-facing invoice data.

## Active Organisation Handling

- If a user has one active membership, use it as the active organisation.
- If a user has multiple active memberships, the backend should support selecting the active organisation explicitly.
- Complex organisation switching UI is deferred from MVP.
- Never infer organisation from frontend-provided `organisationId` on protected resource operations.
- A future endpoint may be added as `POST /me/active-organisation` with request `{ organisationId }`; the organisation ID must belong to the authenticated user.

This endpoint is documented for future support and is not required in T003 unless explicitly scoped later.

## Enforcement Notes

- UI permissions are convenience only; server-side authorization is mandatory.
- RBAC checks should happen before mutation and before returning private data.
- Audit logs should record sensitive administrative actions such as invitations, role changes, invoice voiding, and business profile completion.
- Full audit log access is Owner/Admin only for MVP. Accountant operational history can be exposed later through entity-specific timelines instead of the full audit log.
