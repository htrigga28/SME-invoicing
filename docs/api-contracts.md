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
| `POST /auth/register` | Public, throttled (5/min) | None | `{ email, password, name }` | `{ user, activeOrganisation, membership, businessProfile, accessToken, onboardingRequired: true, onboardingStep: "business_profile" }` + HttpOnly refresh cookie | Duplicate email, weak password, throttled request. |
| `POST /auth/login` | Public, throttled (3/min) | None | `{ email, password }` | `{ user, accessToken, onboardingRequired, onboardingStep }` + HttpOnly refresh cookie | Invalid credentials (no account-enumeration detail). |
| `POST /auth/refresh` | Refresh cookie (or legacy body token while `LEGACY_REFRESH_BODY_ENABLED`) | Member | Cookie; legacy `{ refreshToken }` only when the compatibility flag is enabled | `{ accessToken }` + rotated HttpOnly refresh cookie | Invalid/expired refresh token. |
| `POST /auth/logout` | Required | Member | Cookie; legacy `{ refreshToken? }` when supplied | `{ success: true }`, refresh cookie cleared | Invalid session. |
| `GET /me` | Required | Member | None | `{ user, activeOrganisation, membership, businessProfile, onboardingRequired, onboardingStep }` | No active membership. |
| `POST /me/active-organisation` | Required | Member | `{ organisationId }` | `{ activeOrganisation, membership }` | Organisation not in authenticated user's active memberships. |

Registration rules:

- Creates user, organisation, Owner membership, and blank business profile in one transaction.
- Duplicate email must be rejected.
- Password must be hashed.
- Raw refresh tokens must never be stored; only token hashes are persisted for refresh, rotation, and logout revocation.
- Browser sessions use an HttpOnly refresh cookie on every session-issuing route (login, registration, refresh, legacy exchange, invitation acceptance). JavaScript keeps only the short-lived access token in memory and never persists credentials.
- Refresh rotates the refresh token with a compare-and-swap update: one concurrent use wins and yields the single child token; the loser is rejected. The cookie path takes precedence when both cookie and legacy body tokens are present.
- Pre-cookie browsers migrate once: the stored legacy refresh token is submitted through the compatibility body path, the API sets the cookie and returns the renewed access token, the browser publishes it to the active app context, and only then deletes legacy storage. A failed exchange retains legacy storage. The compatibility path lives behind `LEGACY_REFRESH_BODY_ENABLED`, which is disabled by default and may be enabled only temporarily while pre-cookie clients remain, with a removal date recorded at enablement.
- Logout revokes the cookie token and any submitted legacy token once each, then clears the cookie with the exact set attributes.
- Response must not return password hash.
- `onboardingStep` is `business_profile` until profile and organisation onboarding timestamps are set, `payment_setup` until any organisation payment-account record exists, and `null` afterward.
- `onboardingRequired` remains `onboardingStep !== null` for compatibility.
- Any submitted payment-account record completes onboarding, including `verification_delayed`; disabling it later does not restart onboarding.

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
- After business profile setup, the owner advances to Payment Setup; dashboard access remains blocked until a payment account is submitted.

## Payment Setup

| Endpoint | Auth | Role | Request | Response |
| --- | --- | --- | --- | --- |
| `GET /payment-setup/account` | Required | Owner/Admin/Accountant/Viewer | None | `{ status, paymentAccount }` |
| `GET /payment-setup/banks` | Required | Owner/Admin | None | `{ banks }` |
| `POST /payment-setup/resolve-account` | Required | Owner/Admin | `{ bankCode, accountNumber }` | `{ bankCode, bankName, accountNumberLast4, accountName }` |
| `POST /payment-setup/subaccount` | Required | Owner/Admin | `{ bankCode, accountNumber, confirmedAccountName }` | `{ paymentAccount }` |
| `POST /payment-setup/account/disable` | Required | Owner/Admin | `{ reason? }` | `{ paymentAccount }` |
| `POST /payment-setup/accounts/:id/reactivate` | Required | Owner/Admin | `{ reason? }` | `{ paymentAccount }` |

`GET /payment-setup/account` response when no account exists:

```json
{
  "status": "not_configured",
  "paymentAccount": null
}
```

`GET /payment-setup/account` response when an account exists:

```json
{
  "status": "active",
  "paymentAccount": {
    "id": "payment-account-id",
    "provider": "paystack",
    "bankName": "Access Bank",
    "accountName": "Acme Studio Ltd",
    "accountNumberLast4": "1234",
    "status": "active",
    "verifiedAt": "2026-07-01T12:00:00.000Z",
    "disabledAt": null,
    "createdAt": "2026-07-01T12:00:00.000Z",
    "updatedAt": "2026-07-01T12:00:00.000Z"
  }
}
```

Frontend responses must not expose `organisation_id`, full account numbers, raw Paystack metadata, `PAYSTACK_SECRET_KEY`, or `provider_subaccount_code`.

`GET /payment-setup/banks` response shape:

```json
{
  "banks": [
    {
      "name": "Access Bank",
      "code": "044",
      "country": "Nigeria",
      "currency": "NGN",
      "active": true
    }
  ]
}
```

`POST /payment-setup/resolve-account` rules:

- Backend calls Paystack Resolve Account Number using the selected Nigerian bank.
- Response returns only safe details.
- Full account number must not be persisted as part of the resolved response.

`POST /payment-setup/subaccount` rules:

- Backend re-resolves the account before creating the subaccount.
- Backend compares the provider-resolved account name to `confirmedAccountName`.
- Backend creates the Paystack subaccount through the platform integration.
- Backend stores `provider_subaccount_code` and masked account details only.
- Backend does not persist the full account number after subaccount creation.
- Backend disables any previous active Paystack account for the organisation/provider before inserting the new active account.

`POST /payment-setup/subaccount` response shape:

```json
{
  "paymentAccount": {
    "id": "payment-account-id",
    "provider": "paystack",
    "bankName": "Access Bank",
    "accountName": "Acme Studio Ltd",
    "accountNumberLast4": "1234",
    "status": "active",
    "verifiedAt": "2026-07-01T12:00:00.000Z"
  }
}
```

`POST /payment-setup/accounts/:id/reactivate` rules:

- Backend scopes the account lookup to the authenticated user's active organisation.
- Only disabled Paystack accounts with an existing stored `provider_subaccount_code` can be reactivated.
- Reactivation uses the existing stored Paystack subaccount; it does not re-resolve bank details and does not create a new Paystack subaccount.
- Reactivation clears `disabled_at`, sets status to `active`, and disables any other active Paystack account for the organisation/provider.
- Changing the payout bank account still requires the full setup flow again because the app does not store full account numbers.
- Frontend responses must not expose `provider_subaccount_code`.

Payment Setup RBAC rules:

- Owner/Admin can manage Payment Setup.
- Accountant/Viewer can view Payment Setup status if the product exposes it.
- Only Owner/Admin can list setup banks, resolve accounts, create subaccounts, or disable a payment account.
- Backend remains the source of truth for payment account status and activation.
- Public invoice payment initialization requires and uses the active organisation `provider_subaccount_code`.

## Team Invitations and Members

| Endpoint | Auth | Role | Request | Response | Important errors |
| --- | --- | --- | --- | --- | --- |
| `POST /team/invitations` | Required | Owner/Admin | `{ email, role }` | `{ invitation, inviteUrl? }` | Role not allowed, duplicate member, duplicate pending invite. |
| `GET /team/invitations` | Required | Owner/Admin | Query filters | `{ invitations }` | Forbidden. |
| `POST /team/invitations/:id/revoke` | Required | Owner/Admin | None | `{ invitation }` | Not found, already accepted. |
| `GET /team/members` | Required | Owner/Admin | None | `{ members }` | Forbidden. |
| `PATCH /team/members/:id` | Required | Owner/Admin | `{ role?, status? }` | `{ member }` | Not found, forbidden target role, self-management. |
| `POST /team/members/:id/remove` | Required | Owner/Admin | None | `{ member }` | Not found, forbidden target role, self-removal. |
| `GET /invitations/:token` | Public | None | None | `{ invitation: { organisationName, email, role, expiresAt } }` | Invalid, expired, revoked, accepted. |
| `POST /invitations/:token/accept` | User auth or registration flow | Invited email | Existing user: `{ mode: "existing" }`; new user: `{ mode: "new", name, password }` | `{ user, organisation, membership, accessToken, refreshToken, onboardingRequired }` | Invalid, expired, revoked, email mismatch. |

Rules:

- Invite token must be validated and stored only as a hash.
- Invite must not be expired, revoked, or accepted.
- Invite email must match accepting user's email.
- Accepted invite creates organisation membership.
- A user is not an organisation member until the invitation is accepted.
- Duplicate pending invitations for the same organisation and email must be blocked.
- Owner can invite Admin, Accountant, and Viewer.
- Admin can invite Accountant and Viewer only.
- Owner can update/remove Admin, Accountant, and Viewer members.
- Admin can update/remove Accountant and Viewer members only.
- Owner transfer and Owner removal are out of scope for the MVP.
- Production email delivery is deferred; the create-invitation response may include `inviteUrl` for development/demo use.

## Customers

| Endpoint | Auth | Role | Request | Response |
| --- | --- | --- | --- | --- |
| `GET /customers` | Required | Owner/Admin/Accountant/Viewer | Query: `search?`, `status?=active|archived|all`, `page?`, `limit?` | `{ customers, pagination }` |
| `POST /customers` | Required | Owner/Admin/Accountant | `{ name, email, phone?, billingAddress? }` | `{ customer }` |
| `GET /customers/:id` | Required | Owner/Admin/Accountant/Viewer | None | `{ customer, invoiceSummary, invoices }` |
| `PATCH /customers/:id` | Required | Owner/Admin/Accountant | `{ name?, email?, phone?, billingAddress? }` | `{ customer }` |
| `POST /customers/:id/archive` | Required | Owner/Admin/Accountant | `{ reason? }` | `{ customer }` |

Tenant rule: customer lookup and mutation must include current organisation scope.

Customer rules:

- Customer responses include `id`, `name`, `email`, `phone`, `billingAddress`, `status`, `archivedAt`, `createdAt`, and `updatedAt`.
- `organisationId` is not accepted from the frontend and is not exposed in customer responses.
- Emails are normalized to lowercase before persistence.
- Duplicate active customer emails are blocked within the same organisation.
- Archived customers are excluded from the default list, remain readable, and cannot be updated in the MVP.
- Customer detail includes a recent invoice history list and summary totals scoped to the current organisation.

## Invoices

| Endpoint | Auth | Role | Request | Response |
| --- | --- | --- | --- | --- |
| `GET /invoices` | Required | Owner/Admin/Accountant/Viewer | Query: `search?`, `status?`, `customerId?`, `fromDate?`, `toDate?`, `page?`, `limit?` | `{ invoices, pagination }` |
| `POST /invoices` | Required | Owner/Admin/Accountant | `{ customerId, issueDate, dueDate, customerReference?, lineItems, discount?, tax?, notes? }` | `{ invoice }` |
| `GET /invoices/:id` | Required | Owner/Admin/Accountant/Viewer | None | `{ invoice, lineItems, statusEvents, publicUrl, paymentSummary, delivery, viewSummary }` |
| `GET /invoices/:id/activity` | Required | Owner/Admin/Accountant/Viewer | None | `{ activity, viewSummary }` |
| `PATCH /invoices/:id` | Required | Owner/Admin/Accountant | Draft-only editable invoice fields | `{ invoice }` |
| `POST /invoices/:id/send` | Required | Owner/Admin/Accountant | `{ to?, cc?, subject? }` | `{ invoice, publicUrl, delivery }` |
| `POST /invoices/:id/resend` | Required | Owner/Admin/Accountant | `{ to?, cc?, subject? }` | `{ delivery }` |
| `POST /invoices/:id/duplicate` | Required | Owner/Admin/Accountant | None | `{ invoice, lineItems, statusEvents, publicUrl, paymentSummary }` in the authenticated detail shape for the new draft |
| `POST /invoices/:id/cancel` | Required | Owner/Admin | `{ reason }` | `{ invoice }` |
| `POST /invoices/:id/void` | Required | Owner/Admin | `{ reason }` | `{ invoice }` |

Rules:

- Totals are calculated server-side.
- Invoice numbers and public tokens are generated server-side.
- Invoice numbers are organisation-scoped and use the format `INV-000001`.
- Created invoices start as private drafts. Sending a draft enables public access and returns the generated public URL for T007.
- `POST /invoices/:id/send` accepts optional `{ to?, cc?, subject? }`. When `to` is omitted it defaults to the customer email. Recipients are normalized (trimmed, lower-cased, deduped); To/CC overlap is removed; at most 10 recipients; invalid addresses return `400` before the invoice is issued.
- Sending issues the invoice first (`draft → sent`, public access enabled) using a compare-and-set update (`WHERE status = 'draft'`), then attempts Resend email delivery. Concurrent sends race safely: exactly one request transitions the draft, and only the winner sends email; losers receive `409`. The response always includes `delivery: { state, message, attempts, lastCommunication }` with state `accepted`, `delivered`, `delayed`, `failed`, `sending`, `not_emailed`, `uncertain`, `in_progress`, or `partially_failed`.
- Provider submission and post-submission persistence are separate error boundaries. A definite provider rejection marks the attempt failed; an ambiguous outcome (network/timeout/5xx/unreadable response) records `submission_uncertain` and never rewrites an accepted send as failed. Audit-log failures never change delivery state.
- Each send attempt carries a deterministic `provider_idempotency_key` (sent to Resend as the `Idempotency-Key` request option, retained 24 hours) with an identical payload on retry. Resending while the latest attempt is `submission_uncertain` reuses that key so provider-side retries cannot duplicate mail; a true user-requested resend creates a new communication row and a new key. Resend calls are bounded by `RESEND_REQUEST_TIMEOUT_MS` (default 15000ms); timeouts are treated as ambiguous, never as definite failures.
- If email transmission fails after issuance, the invoice remains issued/public; the communication is marked failed and the response message reads `Invoice issued, but the email could not be sent. Copy the public link or try again.` Invoice status is never used to represent email failure.
- If Resend is not configured, issuance still succeeds and `delivery.state` is `not_emailed` with a configuration message. Delivery is never faked.
- `POST /invoices/:id/resend` creates a NEW communication attempt for an issued invoice (`sent`, `viewed`, `overdue`, `partially_paid`, `paid` with public access enabled). Old attempts remain in history. Draft, cancelled, and void invoices return `422`.
- `GET /invoices/:id/activity` aggregates status events, invoice edits, email delivery events (including per-recipient failures and `email_uncertain` items), view summary, payments, refunds, and receipts into reverse-chronological `{ id, type, occurredAt, title, detail?, tone?, actor?, metadata? }` items. Responses contain only safe display fields (no organisation IDs, tokens, subaccount codes, or raw provider payloads). Repeated public views collapse into one `invoice_viewed` item with count/first/last.
- `GET /invoices/:id` also returns `delivery` (latest email delivery state) and `viewSummary` (`{ viewCount, firstViewedAt, lastViewedAt }`, null when never viewed). Detail invoices expose `lastViewedAt` and `viewCount`.
- MVP uses invoice-level `discount_kobo` and `tax_kobo`; line items do not have per-line tax or discount.
- Invoice `subtotal_kobo` is the sum of server-calculated line totals, and `total_kobo` is `subtotal_kobo - discount_kobo + tax_kobo`.
- `customerReference` is an optional customer-facing reference/PO number (maximum 120 characters) returned in authenticated detail and the public response. `notes` is the customer-facing memo.
- Accountant can create, edit, send, and duplicate invoices but cannot cancel or void invoices.
- Draft edit replaces line items transactionally and recalculates totals server-side.
- Updating a draft with an unchanged customer keeps that customer even if archived since; replacing the customer requires an active customer.
- Duplicate builds an allow-listed create input from the source and delegates to the existing creation path: new number, token, IDs, draft status, zeroed paid amount, issue date of today with the source issue-to-due interval preserved, copied lines/discount/tax/memo, and cleared `customerReference`. Payments, receipts, tokens, timestamps, and history are never copied. Duplication against an archived source customer returns `422` with `Archived customers cannot be used for duplicated invoices. Reactivate the customer or choose an active customer.`
- Cancel requires Owner/Admin, a reason, and status `draft`, `sent`, `viewed`, or `overdue`.
- Void requires Owner/Admin, a reason, and status `draft`, `sent`, `viewed`, `overdue`, or `cancelled`; public access is disabled.
- Mutations are blocked for invoices in incompatible statuses.

## Catalogue Items

| Endpoint | Auth | Role | Request | Response |
| --- | --- | --- | --- | --- |
| `GET /catalogue-items` | Required | Owner/Admin/Accountant/Viewer | Query: `search?`, `status?=active\|archived\|all` (default `active`) | `{ catalogueItems }` |
| `POST /catalogue-items` | Required | Owner/Admin/Accountant | `{ name, description?, defaultUnitPriceKobo }` | `{ catalogueItem }` |
| `PATCH /catalogue-items/:id` | Required | Owner/Admin/Accountant | `{ name?, description?, defaultUnitPriceKobo? }` | `{ catalogueItem }` |
| `POST /catalogue-items/:id/archive` | Required | Owner/Admin/Accountant | None | `{ catalogueItem }` |
| `POST /catalogue-items/:id/restore` | Required | Owner/Admin/Accountant | None | `{ catalogueItem }` |

Rules:

- Organisation scope derives from the active membership; foreign IDs return a safe not-found result.
- Name is required (maximum 200 characters); description is optional (maximum 2,000 characters); price is integer kobo within the signed-integer ceiling.
- Archived items cannot be updated; archive/restore is reversible and audited. Saved invoices never read live catalogue values.

## Public Invoice and Paystack Initialization

| Endpoint | Auth | Role | Request | Response |
| --- | --- | --- | --- | --- |
| `GET /public/invoices/:token` | Public | None | None | `{ invoice, business, customer, lineItems, paymentSummary }` |
| `POST /public/invoices/:token/view` | Public | None | None | `{ success: true }` |
| `POST /public/invoices/:token/pay` | Public | None | `{}` | `{ authorizationUrl, accessCode, reference }` |
| `POST /public/invoices/:token/payments/:reference/verify` | Public | None | None | `{ status, invoiceUpdated }` |

Rules:

- No authentication required.
- Token must be unguessable.
- Public invoice lookup requires a valid `public_token`, `public_access_enabled = true`, and an invoice that is not `draft`, `cancelled`, or `void`.
- Invalid, disabled, cancelled, void, or otherwise unavailable invoice links return the same safe not-found response.
- Public response exposes only customer-facing invoice data: invoice display fields (including `customerReference` and the customer memo in `notes`), business contact fields, customer billing fields, line items, and a safe payment summary.
- Public page must not expose internal organisation/member data.
- Public view tracking records an `invoice_view_events` row on every valid view, increments `viewCount`, and updates `lastViewedAt` without changing invoice status, except that the first eligible view moves `sent` to `viewed` once and writes a safe status event and audit log. The view endpoint returns `{ success, viewCount, firstViewedAt, lastViewedAt }`.
- Repeated public views must not create duplicate viewed transitions.
- Overdue invoices must not move back to `viewed`.
- Public invoice viewing remains available even when Payment Setup is incomplete.
- `POST /public/invoices/:token/pay` must first confirm the organisation has an active Paystack payment account.
- Payment initialization amount is calculated server-side from `invoice.balance_due_kobo`.
- The frontend must never send or control the payable amount.
- The frontend must never send `subaccount`.
- Backend derives `provider_subaccount_code` from the active organisation payment account and uses it when initializing Paystack.
- `POST /public/invoices/:token/pay` creates a pending payment record, calls Paystack transaction initialization, stores `authorizationUrl`, `accessCode`, `reference`, and `provider_subaccount_code`, and writes a `payment_initialized` audit log.
- If no active payment account exists, return a safe unavailable message such as `This business has not activated online payments yet.`
- If the current payment account is `verification_delayed`, return `Online payments are not active for this business yet. Please try again later.`
- If the current payment account is `disabled`, return `Online payments are currently disabled for this business.`
- Public partial payment entry is not exposed in MVP.
- Payment initialization is blocked for paid, cancelled, void, or public-access-disabled invoices.
- Payment initialization is available for payable `sent`, `viewed`, `overdue`, and `partially_paid` public invoices with an outstanding balance.
- Payment initialization does not mark the invoice paid, does not update `amount_paid_kobo`, and does not update `balance_due_kobo`.
- Paystack secret keys are backend-only. The public frontend only receives the Paystack authorization URL returned by the API.
- After Paystack redirects the customer back with a reference, the frontend may call `POST /public/invoices/:token/payments/:reference/verify`. The backend verifies that the reference belongs to the invoice token, calls Paystack Verify Transaction server-side, validates reference, amount, and currency, and then uses the same idempotent reconciliation path as the `charge.success` webhook.
- The verify endpoint is a fallback for local or delayed webhook delivery. It must never trust the frontend callback as proof of payment and must not expose raw Paystack verification data.

Preferred MVP initialization payload sent from backend to Paystack:

```json
{
  "email": "customer@example.com",
  "amount": 500000,
  "reference": "SME-INV-000001-ABC123",
  "subaccount": "ACCT_xxxxx",
  "bearer": "subaccount"
}
```

Public invoice `paymentSummary` examples:

- Active payment account:

```json
{
  "available": true,
  "provider": "paystack",
  "amountKobo": 500000,
  "currency": "NGN",
  "message": "Pay securely online."
}
```

- Payment setup incomplete:

```json
{
  "available": false,
  "reason": "payment_setup_incomplete",
  "message": "This business has not activated online payments yet."
}
```

- Payment setup pending:

```json
{
  "available": false,
  "reason": "payment_setup_pending",
  "message": "Online payments are not active for this business yet."
}
```

- Payment setup disabled:

```json
{
  "available": false,
  "reason": "payment_setup_disabled",
  "message": "Online payments are currently disabled for this business."
}
```

- No outstanding balance:

```json
{
  "available": false,
  "reason": "no_outstanding_balance",
  "message": "This invoice has no outstanding balance."
}
```

## Resend Email Webhooks

| Endpoint | Auth | Role | Request | Response |
| --- | --- | --- | --- | --- |
| `POST /webhooks/resend` | Svix signature | Provider | Resend event payload | `{ received: true }` |

Rules:

- No user JWT auth. Requests are verified with the Svix signature scheme against the raw request body using `RESEND_WEBHOOK_SECRET` (`svix-id`, `svix-timestamp`, `svix-signature` headers, 5-minute timestamp tolerance). Missing secret configuration returns `503`; missing/invalid signature or stale timestamps return `401`. The secret is never logged.
- Organisation scope is resolved from the stored communication matched by Resend `email_id`, falling back to the validated `lumina_communication` tag UUID. Tenant claims in the payload are never trusted.
- Unknown email IDs return `{ received: true, unknown: true }` and are quarantined durably; events without a valid Svix message id return `{ received: true, ignored: true }` without `500` errors.
- Each event is persisted once keyed by `resend:<svix message id>`; replays return `{ received: true, duplicate: true }` without touching delivery state. Distinct events for one email produce distinct rows.
- Event mapping: `email.sent` → accepted; `email.delivered` → delivered; `email.delivery_delayed` → deferred; `email.bounced`/`email.failed`/`email.complained` → failed. Open/click events are stored without changing delivery state.
- Webhook events advance every listed recipient with an atomic conditional update (`WHERE id AND status = <previously read>`); concurrent deliveries cannot regress each other. The parent communication exposes the derived aggregate: all delivered → `delivered`; all failed → `failed`; any failed → `partially_failed`; any deferred → `deferred`; all accepted → `accepted`; otherwise → `in_progress`. Audit entries are written only when a transition (or aggregate change to a terminal state) actually applies.
- Email open events never mark the invoice `viewed`. Public invoice viewing is the only source of view state.

## Payments

| Endpoint | Auth | Role | Request | Response |
| --- | --- | --- | --- | --- |
| `POST /payments/paystack/webhook` | Paystack signature | Provider | Raw Paystack body | `{ received: true }` |
| `GET /payments` | Required | Owner/Admin/Accountant/Viewer | Query: `view`, `search`, `status`, `customerId`, `invoiceId`, `reconciliationState`, `dateFrom`, `dateTo`, `page`, `limit` | `{ payments, pagination }` |
| `GET /payments/summary` | Required | Owner/Admin/Accountant/Viewer | Query: `dateFrom`, `dateTo` | `{ totals, statusBreakdown, recentPayments }` |
| `GET /payments/events/review` | Required | Owner/Admin/Accountant/Viewer | Query: `page`, `limit`, `eventType`, `processed` | `{ events, pagination }` |
| `GET /payments/:id` | Required | Owner/Admin/Accountant/Viewer | None | `{ payment, invoice, customer, settlementAccount, events }` |
| `POST /payments/:id/refunds` | Required | Owner/Admin | `{ amountKobo, reason }` | `{ refund, financialSummary }` |

T013 payment/reconciliation views are read-oriented. The only T013 payment mutation is the minimum Owner/Admin overpayment-refund request workflow. T013 does not create manual payments, manually mutate reconciliation state, export CSV files, or generate receipts.

Payment records are Paystack checkout/payment attempts. The default Payments page is reconciliation-focused, not raw attempt history.

Invoice financial fields are derived from persisted payment/refund truth:

```text
grossSuccessfulKobo = sum(successful payments)
processedRefundsKobo = sum(processed refunds for those payments)
netReceivedKobo = max(grossSuccessfulKobo - processedRefundsKobo, 0)
appliedToInvoiceKobo = min(netReceivedKobo, invoice.total_kobo)
overpaymentKobo = max(netReceivedKobo - invoice.total_kobo, 0)
balanceDueKobo = max(invoice.total_kobo - netReceivedKobo, 0)
```

`invoice.amount_paid_kobo` stores `netReceivedKobo`, so it can exceed `invoice.total_kobo` when an invoice is overpaid. `invoice.balance_due_kobo` must never be negative.

`GET /payments` supports `view`:

- `reconciliation` default: shows successful payments, active/stale pending confirmations, true review-required records, and the latest meaningful failed/abandoned attempt for an unpaid invoice. Superseded retry attempts are hidden.
- `all_attempts`: shows every stored payment attempt for audit/support.
- `review_required`: shows only payment attempts with true reconciliation problems.
- Pagination is defensive: if filtering or classification leaves the requested page outside the available range, the API returns the last available page so the UI cannot strand the user on an empty page without navigation.

`GET /payments` returns safe list items:

```json
{
  "payments": [
    {
      "id": "uuid",
      "provider": "paystack",
      "providerReference": "PAYSTACK_REF",
      "status": "successful",
      "attemptState": "successful",
      "reconciliationState": "matched",
      "reviewState": "none",
      "reviewResolution": null,
      "isSuperseded": false,
      "supersededReason": null,
      "currency": "NGN",
      "amountKobo": 97500,
      "netContributionKobo": 97500,
      "processedRefundedKobo": 0,
      "paidAt": "2026-06-30T10:00:00.000Z",
      "failedAt": null,
      "abandonedAt": null,
      "initializedAt": "2026-06-30T09:59:00.000Z",
      "createdAt": "2026-06-30T09:59:00.000Z",
      "invoice": {
        "id": "uuid",
        "invoiceNumber": "INV-000011",
        "status": "paid",
        "totalKobo": 97500,
        "amountPaidKobo": 97500,
        "balanceDueKobo": 0
      },
      "customer": {
        "id": "uuid",
        "name": "Lagos Bright Prints",
        "email": "accounts@example.test"
      },
      "settlementAccount": {
        "provider": "paystack",
        "bankName": "United Bank for Africa",
        "accountName": "Akin & Co Creative Services",
        "accountNumberLast4": "9090"
      },
      "settlementAccountContext": {
        "currentStatus": "disabled",
        "isCurrentActiveAccount": false,
        "isHistorical": true
      },
      "refundSummary": {
        "count": 0,
        "pendingKobo": 0,
        "processedKobo": 0,
        "needsAttentionCount": 0,
        "failedCount": 0
      },
      "latestEventSummary": {
        "eventType": "charge.success",
        "processed": true,
        "errorMessage": null,
        "createdAt": "2026-06-30T10:00:00.000Z"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

Attempt state is computed in service logic. Allowed values are `successful`, `active_pending`, `stale_pending`, `failed_attempt`, `abandoned_attempt`, `refunded_attempt`, `superseded`, `review_required`, and `unknown`.

Reconciliation state is computed in service logic. Allowed values are `matched`, `pending_confirmation`, `stale_pending`, `failed`, `abandoned`, `refunded`, `superseded`, `review_required`, `overpaid`, `resolution_in_progress`, `resolved`, and `unknown`.

Review state is computed in service logic as `none`, `open`, `resolution_in_progress`, or `resolved`. Review resolution can be `resolved_by_later_payment`, `superseded`, `refund_pending`, `refund_processed`, `provider_resolved`, or `null`.

Superseded attempts are retained for audit/support but no longer affect invoice balance. Examples include pending/failed/abandoned retries after another successful payment has already paid the invoice, or attempts for invoices that no longer accept payment.

Normal failed or abandoned checkout attempts are not `review_required` unless there is a true reconciliation problem such as amount mismatch, currency mismatch, unknown reference, cancelled/void invoice payment, overpayment, refund failure/provider attention, processing error, missing expected subaccount trace on a successful payment, or safely inferable settlement mismatch.

An old non-success amount mismatch, failed attempt, abandoned attempt, or pending retry can be resolved by a later successful payment when the old attempt did not move money and the invoice is now financially settled. The record remains visible in `view=all_attempts` with resolved/superseded context but is removed from active Needs Review.

Settlement account responses are safe summaries derived by matching `payments.provider_subaccount_code` to an organisation payment account. The API does not expose `provider_subaccount_code`, full bank account numbers, raw webhook payloads, raw Paystack responses, organisation IDs, token hashes, or secrets.

`settlementAccount` describes the payout account used for that payment. `settlementAccountContext` describes current/historical context separately, so a historically valid payment can show "Historical account" without implying the payment itself is invalid. Matching must use the same organisation, same provider, and exact `provider_subaccount_code`; bank name or last4 are not enough.

Amount mismatch checks compare Paystack subunit amounts directly against `payments.amount_kobo`. They must not compare formatted NGN strings or divide only one side by 100. Genuine amount/currency mismatches can include safe `reviewDetails` with `expectedAmountKobo`, `receivedAmountKobo`, and `currency`.

`GET /payments/:id` returns safe event timeline entries only:

```json
{
  "events": [
    {
      "id": "uuid",
      "eventType": "charge.success",
      "providerReference": "PAYSTACK_REF",
      "processed": true,
      "processedAt": "2026-06-30T10:00:01.000Z",
      "errorMessage": null,
      "createdAt": "2026-06-30T10:00:00.000Z"
    }
  ],
  "refunds": [
    {
      "id": "uuid",
      "amountKobo": 170000,
      "currency": "NGN",
      "status": "pending",
      "reason": "Duplicate customer payment",
      "createdAt": "2026-07-06T10:00:00.000Z",
      "processedAt": null
    }
  ],
  "financialSummary": {
    "grossSuccessfulKobo": 340000,
    "processedRefundsKobo": 0,
    "netReceivedKobo": 340000,
    "appliedToInvoiceKobo": 170000,
    "overpaymentKobo": 170000,
    "balanceDueKobo": 0,
    "paymentCount": 2,
    "successfulPaymentCount": 2,
    "hasOverpayment": true
  },
  "receipt": {
    "id": "uuid",
    "receiptNumber": "RCT-000001",
    "publicUrl": "https://app.example/receipt/public-token",
    "issuedAt": "2026-06-30T10:01:00.000Z"
  },
  "receiptPlaceholder": null
}
```

`POST /payments/:id/refunds` rules:

- Owner/Admin only. Accountant/Viewer remain read-only.
- Payment must belong to the active organisation and must be `successful`.
- Every financial mutation locks in invoice, then payment, then refund order and re-reads truth under the lock before validating.
- Refund amount must be positive, must not exceed the invoice overpayment, and must not exceed the selected payment's remaining refundable amount.
- Backend creates a local refund reservation first with a stable `lumina-refund:<payment_refunds.id>` token in Paystack `merchant_note`, calls Paystack Create Refund server-side with the original transaction reference, then stores normalized safe provider status.
- A definite provider rejection (400/404/422/409) marks the reservation `failed`; a timeout, 5xx, rate limit, or unreadable response marks it `needs_attention` and keeps the capacity reserved until authoritative reconciliation.
- Refund initiation does not reduce `amount_paid_kobo`. Only a processed refund event reduces net received.
- Paystack refund statuses map to `pending`, `processing`, `needs_attention`, `processed`, and `failed`.
- Responses must not expose raw Paystack refund responses, secrets, `provider_subaccount_code`, card/authorization data, or customer bank details.

`POST /payments/:paymentId/refunds/:refundId/reconcile` rules:

- Owner/Admin only; tenant scope derives from the authenticated context (`404` for foreign or mismatched pairs). No request body: the caller cannot choose a target status or release capacity.
- Reads authoritative Paystack evidence only: direct `GET /refund/:id` when `providerRefundId` exists, otherwise resolves the provider transaction ID from the payment reference and lists `GET /refund?transaction=<id>`, matching exactly one result by stable merchant-note token, transaction, amount, and currency.
- Zero matches, multiple matches, provider timeout, or inconsistent fields leave the reservation in `needs_attention` and never release capacity. Only explicit provider `failed` proof releases reserved capacity; `processed` triggers invoice reconciliation under the invoice, payment, refund lock order.
- Allowed transitions: `needs_attention`/`pending`/`processing` to `pending`/`processing`/`needs_attention`/`processed`/`failed`; `processed`/`failed` are terminal for this route. Repeated calls with the same evidence are idempotent; concurrent calls serialize under the financial locks.
- Records the actor, local IDs, evidence type, prior/final status, and observation time through the existing audit path without raw payloads.

`GET /payments/events/review` only returns organisation-scoped events that have safe review signals such as processing errors or unprocessed state. Events with null `organisation_id` are excluded unless they can be safely scoped through a linked payment reference.

`GET /payments/events/review` excludes ordinary unsupported/duplicate provider events that do not require human reconciliation work.

Webhook endpoint rules:

- Verify signature with raw request body before trusting payload content.
- Uses Paystack signature authentication, not user JWT auth.
- Reads `x-paystack-signature` and verifies HMAC SHA512 against the raw request body with `PAYSTACK_SECRET_KEY`.
- Must not verify against `JSON.stringify(req.body)`.
- Parses JSON only after signature verification succeeds.
- Handles `charge.success` in T009.
- Handles refund events `refund.pending`, `refund.processing`, `refund.needs-attention`, `refund.failed`, and `refund.processed`.
- The `charge.success` webhook and server-side Verify Transaction fallback share the same idempotent successful-payment reconciliation service.
- Stores a redacted payment event before or during processing.
- Matches `data.reference` to an existing Paystack payment reference.
- Validates amount and `NGN` currency before marking payment successful.
- Recalculates invoice `amount_paid_kobo`, `balance_due_kobo`, and payment-derived status after successful validation.
- Recalculates invoice financial state after `refund.processed`. Pending/processing refunds leave net received unchanged; failed or needs-attention refunds keep overpayment review open.
- Returns `{ received: true }` for processed, ignored, duplicate, mismatch, or unknown-reference events with valid signatures.
- Rejects missing or invalid signatures safely.
- T014 generates one immutable receipt for each provider-confirmed successful payment through the shared webhook/Verify Transaction reconciliation path.

## Receipts

| Endpoint | Auth | Role | Request | Response |
| --- | --- | --- | --- | --- |
| `GET /receipts` | Required | Owner/Admin/Accountant/Viewer | Query: search, customerId, invoiceId, refundState, dateFrom, dateTo, page, limit | `{ receipts, pagination }` |
| `GET /receipts/:id` | Required | Owner/Admin/Accountant/Viewer | None | `{ receipt }` |
| `GET /public/receipts/:token` | Public | None | None | `{ receipt }` |

Tenant rule: internal receipts must be scoped by current organisation and linked invoice/payment ownership. Public receipt lookup uses only the unguessable `public_token` and requires `public_access_enabled = true`.

`GET /receipts` response items include safe receipt list data:

```json
{
  "id": "uuid",
  "receiptNumber": "RCT-000001",
  "amountKobo": 100000,
  "currency": "NGN",
  "issuedAt": "2026-06-30T10:01:00.000Z",
  "paidAt": "2026-06-30T10:00:00.000Z",
  "paymentReference": "PAYSTACK_REF",
  "paymentProvider": "paystack",
  "invoice": {
    "id": "uuid",
    "invoiceNumber": "INV-000001",
    "status": "paid"
  },
  "customer": {
    "id": "uuid",
    "name": "Lagos Bright Prints",
    "email": "accounts@example.com"
  },
  "refundSummary": {
    "originalAmountKobo": 100000,
    "processedRefundedKobo": 0,
    "netRetainedKobo": 100000,
    "refundState": "none",
    "hasRefundInProgress": false
  }
}
```

`GET /receipts/:id` returns immutable snapshot fields, safe linked invoice/payment/customer IDs for internal navigation, safe refund history, and `publicUrl`. It must not expose `organisation_id`, `provider_subaccount_code`, payout account details, raw provider metadata, full account numbers, or secrets.

`GET /public/receipts/:token` returns public-safe receipt snapshots only. It omits internal IDs, `public_token`, organisation IDs, provider subaccount codes, payout details, and raw provider/refund metadata.

Receipt rules:

- Receipt numbers are generated server-side and never accepted from the frontend.
- Receipt creation is idempotent and guarded by unique `payment_id`.
- Successful payments against cancelled/void invoices still receive receipts because provider-confirmed money moved; reconciliation review remains responsible for the anomaly.
- Processed refunds reduce displayed net retained amount but never rewrite `receipt.amount_kobo`.
- Pending/processing/needs-attention refunds set `hasRefundInProgress` and do not reduce net retained amount.

## Dashboard, Exports, Audit Logs

| Endpoint | Auth | Role | Request | Response |
| --- | --- | --- | --- | --- |
| `GET /dashboard/overview` | Required | Owner/Admin/Accountant/Viewer | Query: `dateFrom`, `dateTo`, `granularity=auto\|day\|week\|month` | `{ period, financialActivity, currentPosition, invoiceStatusBreakdown, outstandingAging, cashflowTrend, recentInvoices, recentPayments, recentReceipts, reviewIssues, paymentSetup }` |
| `GET /exports/customers.csv` | Required | Owner/Admin/Accountant | Query: `search`, `status=active\|archived\|all` | CSV file |
| `GET /exports/invoices.csv` | Required | Owner/Admin/Accountant | Query: `search`, `status`, `customerId`, `issueDateFrom`, `issueDateTo`, `dueDateFrom`, `dueDateTo` | CSV file |
| `GET /exports/payments.csv` | Required | Owner/Admin/Accountant | Query: `search`, `status`, `reconciliationState`, `view`, `dateFrom`, `dateTo`, `customerId`, `invoiceId` | CSV file |
| `GET /exports/receipts.csv` | Required | Owner/Admin/Accountant | Query: `search`, `customerId`, `invoiceId`, `refundState`, `dateFrom`, `dateTo` | CSV file |
| `GET /exports/audit-logs.csv` | Required | Owner/Admin | Query: `search`, `action`, `category`, `actorUserId`, `resourceType`, `dateFrom`, `dateTo` | CSV file |
| `GET /audit-logs` | Required | Owner/Admin | Query: `search`, `action`, `category`, `actorUserId`, `resourceType`, `dateFrom`, `dateTo`, `page`, `limit` | `{ auditLogs, pagination }` |
| `GET /audit-logs/:id` | Required | Owner/Admin | None | `{ auditLog }` |

Dashboard overview derives organisation scope from the authenticated membership and never accepts `organisationId` from the frontend. Period financial activity uses successful `payments.paid_at`, processed `payment_refunds.processed_at`, and receipt `issued_at` within the selected range. Current operational position is not date-filtered and uses current invoice balances plus the same payment/reconciliation classification used by the Payments page.

Dashboard cashflow grouping uses `Africa/Lagos` calendar buckets for display. Default range is the last 30 days, resolved as `dateTo = today` and `dateFrom = 29 days before dateTo`; ranges beyond 2 years are rejected.

Dashboard and exports are blocked while `onboardingStep` is not `null`.

CSV exports are generated synchronously and are not persisted. All export endpoints derive organisation scope from the authenticated membership and enforce backend RBAC. Viewer cannot export. Audit-log CSV export is Owner/Admin only; Accountant can export customers, invoices, payments, and receipts only.

Export responses use `text/csv; charset=utf-8` and `Content-Disposition: attachment; filename="<dataset>-YYYY-MM-DD.csv"`. CSV output uses stable column ordering, CRLF line endings, RFC-style quote escaping, and spreadsheet formula-injection neutralization for cells beginning with dangerous formula characters after optional leading whitespace. Money columns export `currency` separately and use exact decimal NGN strings such as `1700.00`, not formatted display text.

Synchronous exports have a hard 10,000-row limit. If the filtered result exceeds that limit, the API returns a business error: `This export contains more than 10,000 records. Narrow the filters and try again.` Exports must not silently truncate rows.

Successful export generation writes one `export_generated` audit log after the export dataset has been selected. Audit metadata contains only `dataset`, a safe filter summary, `rowCount`, and `generatedAt`; it never stores file content or exported rows. Audit-log exports snapshot rows before writing their own export event so the export does not recursively include itself.

CSV datasets:

- Customers: `customer_name`, `email`, `phone`, `billing_address`, `status`, `created_at`, `updated_at`.
- Invoices: `invoice_number`, `customer_name`, `customer_email`, `status`, `currency`, `issue_date`, `due_date`, `subtotal_ngn`, `discount_ngn`, `tax_ngn`, `total_ngn`, `amount_paid_ngn`, `balance_due_ngn`, `overpayment_ngn`, `sent_at`, `viewed_at`, `paid_at`, `cancelled_at`, `voided_at`, `created_at`.
- Payments: `provider_reference`, `invoice_number`, `customer_name`, `customer_email`, `currency`, `amount_ngn`, `payment_status`, `primary_state`, `reconciliation_state`, `review_state`, `review_reason`, `paid_at`, `failed_at`, `abandoned_at`, `initialized_at`, `settlement_bank_name`, `settlement_account_name`, `settlement_account_last4`, `settlement_account_context`, `processed_refunded_ngn`, `net_payment_contribution_ngn`.
- Receipts: `receipt_number`, `invoice_number`, `customer_name`, `customer_email`, `payment_reference`, `payment_provider`, `payment_channel`, `currency`, `original_payment_ngn`, `processed_refunded_ngn`, `net_retained_ngn`, `refund_state`, `paid_at`, `issued_at`.
- Audit logs: `timestamp`, `actor`, `actor_email`, `action`, `category`, `resource_type`, `resource_identifier`, `metadata_summary`.

Full audit logs are Owner/Admin only for MVP. Accountant operational history can be exposed later through entity-specific timelines, not the full audit log. Viewer cannot access audit logs.

`GET /audit-logs` returns read-only, organisation-scoped events:

```json
{
  "auditLogs": [
    {
      "id": "uuid",
      "action": "invoice_sent",
      "actionLabel": "Invoice Sent",
      "category": "invoice",
      "actor": {
        "id": "uuid",
        "name": "Demo Owner",
        "email": "owner@demo.com"
      },
      "actorLabel": "Demo Owner (owner@demo.com)",
      "resource": {
        "type": "invoice",
        "id": "uuid",
        "label": "INV-000001"
      },
      "metadataSummary": "Invoice Number: INV-000001",
      "createdAt": "2026-07-08T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 1,
    "totalPages": 1
  }
}
```

`GET /audit-logs/:id` includes the same safe event fields plus `metadataFields`, a concise list of redacted key/value rows. The API never returns arbitrary raw metadata JSON, password or token material, provider subaccount codes, full account numbers, public invoice/receipt tokens, raw webhook/provider/refund payloads, or organisation IDs. Safe masked fields such as `accountNumberLast4` may remain visible.
