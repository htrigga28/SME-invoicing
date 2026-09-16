# Lumina Marketing Site

## Monorepo Architecture

The public marketing site lives in `apps/marketing` and is separate from the authenticated product app in `apps/web`.

Local surfaces:

- Marketing: `http://localhost:3002`
- Product app: `http://localhost:3000`
- API: `http://localhost:4000`

Production topology:

- Marketing: `https://<root-domain>`
- Product app: `https://app.<root-domain>`
- API: `https://api.<root-domain>`

## Environment Variables

Marketing uses only public runtime configuration:

- `NEXT_PUBLIC_SITE_URL`: canonical marketing URL.
- `NEXT_PUBLIC_APP_URL`: authenticated product app URL.
- `NEXT_PUBLIC_CONTACT_EMAIL`: contact address shown on legal pages.

The API uses `CORS_ORIGINS` to allow browser requests. Local development should include:

```text
CORS_ORIGINS=http://localhost:3000,http://localhost:3002
TRUST_PROXY=loopback
```

The marketing origin is only needed in `CORS_ORIGINS` if the dormant waitlist form is restored; direct signup runs on the product-app origin.

## Signup Flow

The marketing site does not collect account credentials or create sessions. Its primary CTAs resolve through `NEXT_PUBLIC_APP_URL` to:

```text
https://app.<root-domain>/register
```

The product app then runs three required, resumable steps:

- Account creation
- Business profile
- Payment Setup submission

The API derives the current step from business-profile completion and organisation payment-account history. Marketing never receives or transfers auth tokens.

The former `POST /public/waitlist` endpoint, database table, and stored leads remain retained as a dormant rollback path. The marketing frontend no longer sends requests to it.

Public registration uses the API's configured throttler. `TRUST_PROXY` must match the deployment ingress so forwarded client IPs are interpreted correctly.

## SEO Strategy

Primary search intent:

- invoice payment reconciliation software Nigeria

Secondary search themes:

- Paystack invoice reconciliation
- invoice payment tracking software Nigeria
- invoicing software for Nigerian SMEs
- automated payment matching
- Paystack payment reconciliation
- SME invoice payment tracking
- online invoice payments Nigeria

The homepage uses these themes naturally in title, description, H1/supporting copy, H2 sections, and FAQ content. It avoids unsupported statistics, fake customer logos, fake testimonials, and unsupported security certifications.

## Conversion Goal

Primary conversion: Create Account.

Secondary conversion: Sign In for existing users.

Signup CTAs appear in:

- fixed navigation
- hero
- connected signup close and footer

## Content Rules

Marketing copy must remain accurate to the product:

- Paystack checkout and subaccount settlement are the payment model.
- Lumina does not hold wallet balances.
- Businesses do not paste merchant Paystack secret keys into Lumina.
- Signed webhooks and server-side verification are the provider-truth mechanisms.
- CSV exports are CSV, not Excel files.
- Demo numbers must remain labelled as demo data.

Do not add blog, pricing, fake case studies, fake testimonials, fake customer logos, or unsupported availability/security claims without a new task.

## Performance Approach

The marketing app is mostly static/server-rendered. Client components are limited to interaction-heavy surfaces:

- navigation scroll/mobile state and Product preview motion
- hero payment-trail and connected-trail motion
- outcome explorer tabs and transitions
- signup links remain static and server-rendered

Motion uses `LazyMotion`, `domAnimation`, and `m` components only on those authored surfaces. There is no autoplay video, chart library, perpetual decorative animation, or global client state. FAQ and legal content remain server-rendered with native HTML disclosures where interaction is needed.

## Deployment Expectations

Deploy `apps/marketing` to the root domain and `apps/web` to `app.<root-domain>`. Set `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_APP_URL` for marketing, and configure `NEXT_PUBLIC_API_URL` for the product app. Set `TRUST_PROXY` to the actual API ingress topology before opening public registration.

The `/privacy` and `/terms` pages are draft legal copy and require owner/legal review before production use.
