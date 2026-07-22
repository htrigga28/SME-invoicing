# Marketing Site Plan

## Architecture

Lumina uses a split public/product architecture:

- `apps/marketing`: public marketing website for the root domain.
- `apps/web`: existing authenticated product application. This app remains unchanged in purpose and keeps port `3000`.
- `apps/api`: NestJS API for product and public waitlist endpoints. This app keeps port `4000`.

The workspace already includes `apps/*` in `pnpm-workspace.yaml`, so `apps/marketing` is automatically included. Turbo already runs package `dev`, `build`, `lint`, `typecheck`, and `test` scripts, so the marketing app should expose matching scripts.

## Development Ports

| Surface | Local URL | Notes |
| --- | --- | --- |
| Marketing | `http://localhost:3002` | New public site. Port `3001` is already occupied in the current local environment. |
| Product app | `http://localhost:3000` | Existing `apps/web`; do not rename. |
| API | `http://localhost:4000` | Existing `apps/api`. |

Root `pnpm dev` continues to run Turbo dev tasks. Dedicated marketing scripts can target `@sme-invoicing/marketing` for single-app work.

## Deployment Topology

| Surface | Production URL |
| --- | --- |
| Marketing | `https://<root-domain>` |
| Product app | `https://app.<root-domain>` |
| API | `https://api.<root-domain>` |

Marketing URLs must be configured through environment variables:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_CONTACT_EMAIL`

Sign-in links resolve to `NEXT_PUBLIC_APP_URL/login`. API requests resolve through `NEXT_PUBLIC_API_URL`. Canonical metadata resolves through `NEXT_PUBLIC_SITE_URL`.

## Shared Brand Assets

T017 established the Lumina dark fintech brand in `apps/web/src/app/globals.css` and related documentation:

- Hanken Grotesk through `next/font/google` for product and marketing interface text.
- JetBrains Mono through `next/font/google` for technical labels, references, and financial values.
- Semantic CSS variables for background, surfaces, text, borders, lime accent, warning, danger, muted states, and glows.
- Lucide is the existing icon dependency.

The marketing app should reuse these semantic values and naming concepts in its own CSS without importing the authenticated app component tree.

## Marketing-Only Components

The public site should own its marketing shell and visuals:

- Brand mark and wordmark.
- Fixed marketing navigation and mobile drawer.
- Marketing button/card primitives.
- Section and heading primitives.
- Product preview components based on implemented product workflows.
- FAQ accordion.
- Waitlist form.
- SEO/JSON-LD helpers.

The marketing app must not depend on operational UI components from `apps/web`.

## API Changes Required For Waitlist

Add a public waitlist module to `apps/api`:

- Database table: `marketing_waitlist_entries`.
- Public endpoint: `POST /public/waitlist`.
- No public list endpoint.
- Validate and normalize email.
- Trim optional fields.
- Store UTM and referrer context.
- Store CTA source in `source`.
- Ignore honeypot submissions with the same generic success response.
- Return the same generic success response for duplicate emails.
- Do not expose whether an email already exists.

`CORS_ORIGINS` remains the source of truth for allowed browser origins. Local development should include both `http://localhost:3000` and `http://localhost:3002`.

## SEO Architecture

`apps/marketing` uses Next.js App Router metadata:

- Production `metadataBase`.
- Canonical homepage, privacy, and terms routes.
- Open Graph and Twitter card metadata.
- `app/sitemap.ts`.
- `app/robots.ts`.
- `app/opengraph-image.tsx` using `ImageResponse`.
- Web manifest and favicon/icon routes.
- JSON-LD for Organization, WebSite, SoftwareApplication, and visible FAQPage content.

The homepage should target invoice payment reconciliation search intent naturally without unsupported claims, fake statistics, testimonials, customer logos, or security certifications.

## Route Map

| Route | Purpose |
| --- | --- |
| `/` | Public marketing homepage with waitlist conversion. |
| `/privacy` | Lightweight waitlist privacy notice requiring owner/legal review before production. |
| `/terms` | Lightweight pre-release terms requiring owner/legal review before production. |

Homepage anchors:

- `#payment-trail`
- `#outcomes`
- `#operations`
- `#trust`
- `#faq`
- `#waitlist`

Homepage composition follows the product-led “Payment Trail” direction: hero proof, a connected five-stage explanation, interactive payment outcomes, one operations field, one trust architecture, FAQ, and a unified waitlist close.

## Validation Expectations

T018 should preserve existing product/API builds and add focused validation for:

- Waitlist service privacy/idempotency behavior.
- Waitlist request validation and honeypot handling.
- Marketing navigation links and sign-in URL.
- Hero copy and CTAs.
- FAQ interaction.
- SEO route helpers, sitemap, robots, and structured data.
- Waitlist form labels, validation, state handling, CTA source, and UTM capture.
