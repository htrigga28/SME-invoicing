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
- `NEXT_PUBLIC_API_URL`: API URL for public waitlist submission.
- `NEXT_PUBLIC_CONTACT_EMAIL`: contact address shown on legal pages.

The API uses `CORS_ORIGINS` to allow browser requests. Local development should include:

```text
CORS_ORIGINS=http://localhost:3000,http://localhost:3002
TRUST_PROXY=loopback
```

## Waitlist Flow

The public waitlist form posts to:

```text
POST /public/waitlist
```

Stored fields:

- email and normalized email
- optional name
- optional company name
- optional role
- CTA source
- UTM source, medium, campaign, content, and term
- referrer
- status

Privacy and anti-enumeration rules:

- Duplicate emails return the same generic success response as new emails.
- Honeypot submissions return generic success and are not inserted.
- The public endpoint is limited to five requests per minute per proxy-aware client IP.
- The native form fallback uses `POST`, so no-JavaScript submissions do not put contact details in the page URL or browser history.
- There is no public list endpoint.
- The frontend never sends organisation IDs.

The built-in limiter uses per-instance memory. `TRUST_PROXY` must match the deployment ingress (for example, `loopback,linklocal,uniquelocal` for a private-network proxy) so forwarded client IPs are interpreted correctly. T019 production hardening should move throttling to shared storage and evaluate a managed bot challenge before a multi-instance launch.

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

Primary conversion: Join Waitlist.

Secondary conversion: Sign In for users who already have access.

Waitlist CTAs appear in:

- fixed navigation
- hero
- unified waitlist close and footer

CTA source values are captured as `nav`, `hero`, or `final_cta`.

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
- waitlist form
- waitlist CTA source dispatch

Motion uses `LazyMotion`, `domAnimation`, and `m` components only on those authored surfaces. There is no autoplay video, chart library, perpetual decorative animation, or global client state. FAQ and legal content remain server-rendered with native HTML disclosures where interaction is needed.

## Deployment Expectations

Deploy `apps/marketing` to the root domain and `apps/web` to `app.<root-domain>`. Set `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, and `NEXT_PUBLIC_API_URL` per environment. Ensure `CORS_ORIGINS` on the API includes both the product and marketing origins, and set `TRUST_PROXY` to the actual ingress topology before enabling the public waitlist.

The `/privacy` and `/terms` pages are draft legal copy and require owner/legal review before production use.
