# API Contracts

All protected endpoints derive organisation access from the authenticated user's active membership. Never trust `organisationId` from the frontend. Responses must never include password hashes, raw refresh tokens, raw invitation tokens, raw webhook secrets, or sensitive internal payloads.

## Common Errors

| Code | Meaning |
| --- | --- |
| `400` | Invalid request or validation failure. |
| `401` | Missing or invalid authentication. |
| `403` | Authenticated but role or membership is not allowed. |
| `404` | Resource not found or not visible within current organisation. |
| `409` | Duplicate or conflicting state. |
| `422` | Business rule violation. |

## Auth and Current User

| Endpoint | Auth | Role | Request | Response | Important errors |
| --- | --- | --- | --- | --- | --- |
| `POST /auth/register` | Public | None | `{ email, password, name }` | `{ user, organisation, membership, onboardingRequired: true }` | Duplicate email, weak password. |
| `POST /auth/login` | Public | None | `{ email, password }` | `{ user, accessToken, refreshToken, onboardingRequired }` | Invalid credentials. |
| `POST /auth/refresh` | Refresh token | Member | `{ refreshToken }` | `{ accessToken, refreshToken }` | Invalid/expired refresh token. |
| `POST /auth/logout` | Required | Member | `{ refreshToken? }` | `{ success: true }` | Invalid session. |
| `GET /me` | Required | Member | None | `{ user, activeOrganisation, membership, businessProfile }` | No active membership. |
| `POST /me/active-organisation` | Required | Member | `{ organisationId }` | `{ activeOrganisation, membership }` | Organisation not in authenticated user's active memberships. |

Registration rules:

- Creates user, organisation, Owner membership, and blank business profile in one transaction.
- Duplicate email must be rejected.
- Password must be hashed.
- Raw refresh tokens must never be stored; only token hashes are persisted for refresh, rotation, and logout revocation.
- Refresh should rotate the refresh token, revoke the old token hash, and return a new raw refresh token once.
- Logout should revoke the submitted refresh token hash when provided.
- Response must not return password hash.
- New users with incomplete business profile should be directed to onboarding.

Active organisation rules:

- If the user has one active membership, use it as the active organisation.
- If the user has multiple active memberships, backend should support explicit active organisation selection.
- Complex organisation switching UI is deferred from MVP.
- `POST /me/active-organisation` is documented for future support and is not required in T003 unless explicitly scoped later.
- The requested `organisationId` must belong to the authenticated user.

## Business Profile

| Endpoint | Auth | Role | Request | Response | Tenant rule |
| --- | --- | --- | --- | --- | --- |
| `GET /business-profile` | Required | Owner/Admin/Accountant/Viewer | None | `{ businessProfile }` | Current active organisation only. |
| `PATCH /business-profile` | Required | Owner/Admin | `{ businessName, email, phone, address, logoFileId? }` | `{ businessProfile, onboardingCompleted }` | Current active organisation only. |

Rules:

- Only Owner/Admin can update business profile.
- Completing business profile sets `setup_completed_at` and organisation `onboarding_completed_at`.
- Dashboard access is blocked until business profile setup is complete.

## Team Invitations and Members

| Endpoint | Auth | Role | Request | Response | Important errors |
| --- | --- | --- | --- | --- | --- |
| `POST /team/invitations` | Required | Owner/Admin | `{ email, role }` | `{ invitation, inviteUrl? }` | Role not allowed, duplicate member, duplicate pending invite. |
| `GET /team/invitations` | Required | Owner/Admin | Query filters | `{ invitations }` | Forbidden. |
| `POST /team/invitations/:id/revoke` | Required | Owner/Admin | None | `{ invitation }` | Not found, already accepted. |
| `GET /team/members` | Required | Owner/Admin | None | `{ members }` | Forbidden. |
| `POST /invitations/:token/accept` | User auth or registration flow | Invited email | `{ name?, password? }` | `{ user, organisation, membership }` | Invalid, expired, revoked, email mismatch. |

Rules:

- Invite token must be validated and stored only as a hash.
- Invite must not be expired, revoked, or accepted.
- Invite email must match accepting user's email.
- Accepted invite creates organisation membership.
- A user is not an organisation member until the invitation is accepted.
- Duplicate pending invitations for the same organisation and email must be blocked.

## Customers

| Endpoint | Auth | Role | Request | Response |
| --- | --- | --- | --- | --- |
| `GET /customers` | Required | Owner/Admin/Accountant/Viewer | Query: search, status, page | `{ customers, pagination }` |
| `POST /customers` | Required | Owner/Admin/Accountant | `{ name, email, phone?, billingAddress? }` | `{ customer }` |
| `GET /customers/:id` | Required | Owner/Admin/Accountant/Viewer | None | `{ customer, invoicesSummary }` |
| `PATCH /customers/:id` | Required | Owner/Admin/Accountant | Customer fields | `{ customer }` |
| `POST /customers/:id/archive` | Required | Owner/Admin/Accountant | None | `{ customer }` |

Tenant rule: customer lookup and mutation must include current organisation scope.

## Invoices

| Endpoint | Auth | Role | Request | Response |
| --- | --- | --- | --- | --- |
| `GET /invoices` | Required | Owner/Admin/Accountant/Viewer | Query: status, customer, dates, page | `{ invoices, pagination }` |
| `POST /invoices` | Required | Owner/Admin/Accountant | `{ customerId, issueDate, dueDate, lineItems, discount?, tax?, notes? }` | `{ invoice }` |
| `GET /invoices/:id` | Required | Owner/Admin/Accountant/Viewer | None | `{ invoice, lineItems, payments, statusEvents }` |
| `PATCH /invoices/:id` | Required | Owner/Admin/Accountant | Editable invoice fields | `{ invoice }` |
| `POST /invoices/:id/send` | Required | Owner/Admin/Accountant | None | `{ invoice, publicUrl }` |
| `POST /invoices/:id/cancel` | Required | Owner/Admin | `{ reason }` | `{ invoice }` |
| `POST /invoices/:id/void` | Required | Owner/Admin | `{ reason }` | `{ invoice }` |

Rules:

- Totals are calculated server-side.
- Invoice numbers and public tokens are generated server-side.
- MVP uses invoice-level `discount_kobo` and `tax_kobo`; line items do not have per-line tax or discount.
- Invoice `subtotal_kobo` is the sum of server-calculated line totals, and `total_kobo` is `subtotal_kobo - discount_kobo + tax_kobo`.
- Accountant can create, edit, and send invoices but cannot cancel or void invoices.
- Mutations are blocked for invoices in incompatible statuses.

## Public Invoice and Paystack Initialization

| Endpoint | Auth | Role | Request | Response |
| --- | --- | --- | --- | --- |
| `GET /public/invoices/:token` | Public | None | None | `{ invoice, business, customer, lineItems, paymentSummary }` |
| `POST /public/invoices/:token/view` | Public | None | `{ viewedAt? }` | `{ success: true }` |
| `POST /public/invoices/:token/pay` | Public | None | `{}` | `{ authorizationUrl, accessCode, reference }` |

Rules:

- No authentication required.
- Token must be unguessable.
- Public invoice lookup requires a valid `public_token`, `public_access_enabled = true`, and an invoice that is not `void`.
- Invalid token returns safe error.
- Public response exposes only invoice/payment-facing data.
- Public page must not expose internal organisation/member data.
- Payment initialization amount is calculated server-side from `invoice.balance_due_kobo`.
- The frontend must never send or control the payable amount.
- Public partial payment entry is not exposed in MVP.
- Payment initialization is blocked for paid, cancelled, void, or public-access-disabled invoices.

## Payments

| Endpoint | Auth | Role | Request | Response |
| --- | --- | --- | --- | --- |
| `POST /payments/paystack/webhook` | Paystack signature | Provider | Raw Paystack body | `{ received: true }` |
| `GET /payments` | Required | Owner/Admin/Accountant/Viewer | Query: status, customer, invoice, dates | `{ payments, pagination }` |
| `GET /payments/:id` | Required | Owner/Admin/Accountant/Viewer | None | `{ payment, invoice, customer, events }` |

Webhook endpoint must verify signature with raw request body before trusting payload content.

## Receipts

| Endpoint | Auth | Role | Request | Response |
| --- | --- | --- | --- | --- |
| `GET /receipts` | Required | Owner/Admin/Accountant/Viewer | Query: customer, invoice, dates | `{ receipts, pagination }` |
| `GET /receipts/:id` | Required | Owner/Admin/Accountant/Viewer | None | `{ receipt, payment, invoice, customer }` |
| `GET /invoices/:id/receipts` | Required | Owner/Admin/Accountant/Viewer | None | `{ receipts }` |

Tenant rule: receipts must be scoped by current organisation and linked invoice/payment ownership.

## Dashboard, Exports, Audit Logs

| Endpoint | Auth | Role | Request | Response |
| --- | --- | --- | --- | --- |
| `GET /dashboard/summary` | Required | Owner/Admin/Accountant/Viewer | Query: date range | `{ totals, invoiceStatusBreakdown, recentInvoices, recentPayments, monthlyCollections }` |
| `GET /exports/invoices.csv` | Required | Owner/Admin/Accountant | Query: status, dates, customer | CSV file |
| `GET /audit-logs` | Required | Owner/Admin | Query: actor, action, entity, dates | `{ auditLogs, pagination }` |

Dashboard and exports are blocked until business profile setup is complete.

Full audit logs are Owner/Admin only for MVP. Accountant operational history can be exposed later through entity-specific timelines, not the full audit log. Viewer cannot access audit logs.
