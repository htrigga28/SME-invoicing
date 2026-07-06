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
| `POST /invoices` | Required | Owner/Admin/Accountant | `{ customerId, issueDate, dueDate, lineItems, discount?, tax?, notes? }` | `{ invoice }` |
| `GET /invoices/:id` | Required | Owner/Admin/Accountant/Viewer | None | `{ invoice, lineItems, statusEvents, publicUrl, paymentSummary }` |
| `PATCH /invoices/:id` | Required | Owner/Admin/Accountant | Draft-only editable invoice fields | `{ invoice }` |
| `POST /invoices/:id/send` | Required | Owner/Admin/Accountant | None | `{ invoice, publicUrl }` |
| `POST /invoices/:id/cancel` | Required | Owner/Admin | `{ reason }` | `{ invoice }` |
| `POST /invoices/:id/void` | Required | Owner/Admin | `{ reason }` | `{ invoice }` |

Rules:

- Totals are calculated server-side.
- Invoice numbers and public tokens are generated server-side.
- Invoice numbers are organisation-scoped and use the format `INV-000001`.
- Created invoices start as private drafts. Sending a draft enables public access and returns the generated public URL for T007.
- MVP uses invoice-level `discount_kobo` and `tax_kobo`; line items do not have per-line tax or discount.
- Invoice `subtotal_kobo` is the sum of server-calculated line totals, and `total_kobo` is `subtotal_kobo - discount_kobo + tax_kobo`.
- Accountant can create, edit, and send invoices but cannot cancel or void invoices.
- Draft edit replaces line items transactionally and recalculates totals server-side.
- Cancel requires Owner/Admin, a reason, and status `draft`, `sent`, `viewed`, or `overdue`.
- Void requires Owner/Admin, a reason, and status `draft`, `sent`, `viewed`, `overdue`, or `cancelled`; public access is disabled.
- Mutations are blocked for invoices in incompatible statuses.

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
- Public response exposes only customer-facing invoice data: invoice display fields, business contact fields, customer billing fields, line items, and a safe payment summary.
- Public page must not expose internal organisation/member data.
- Public view tracking moves `sent` to `viewed` only once and writes a safe status event and audit log.
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
  "receiptPlaceholder": "Receipts will be available after T014."
}
```

`POST /payments/:id/refunds` rules:

- Owner/Admin only. Accountant/Viewer remain read-only.
- Payment must belong to the active organisation and must be `successful`.
- The backend recalculates invoice financial state before validating the refund.
- Refund amount must be positive, must not exceed the invoice overpayment, and must not exceed the selected payment's remaining refundable amount.
- Backend creates a local refund record, calls Paystack Create Refund server-side with the original transaction reference, then stores normalized safe provider status.
- Refund initiation does not reduce `amount_paid_kobo`. Only a processed refund event reduces net received.
- Paystack refund statuses map to `pending`, `processing`, `needs_attention`, `processed`, and `failed`.
- Responses must not expose raw Paystack refund responses, secrets, `provider_subaccount_code`, card/authorization data, or customer bank details.

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
- Receipt generation remains T014 and is not performed by the webhook in T009.

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
