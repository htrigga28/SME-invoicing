# Deployment Plan

## Likely Deployment Approach

| Area | Options | MVP preference |
| --- | --- | --- |
| Frontend | Vercel, Cloudflare Pages, Netlify | Vercel for Next.js simplicity. |
| Backend | Render, Fly.io, Koyeb | Render or Fly.io for a NestJS API. |
| Database | Neon PostgreSQL | Neon PostgreSQL. |
| File storage | Cloudflare R2 later | Defer until file upload is needed. |
| Email | Brevo later | Defer production email automation. |
| Payments | Paystack test mode | Required for MVP demo. |

The deployment should prioritize reliable demo access over complex infrastructure.

## Environment Variable Categories

| Category | Examples |
| --- | --- |
| Database URL | `DATABASE_URL` |
| JWT secrets | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` |
| Paystack secret key | `PAYSTACK_SECRET_KEY` |
| Paystack public key | `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` |
| Paystack webhook signature config | `PAYSTACK_WEBHOOK_SECRET` or documented signature source |
| Frontend app URL | `FRONTEND_APP_URL` |
| Backend API URL | `NEXT_PUBLIC_API_URL`, `BACKEND_API_URL` |
| CORS origins | `CORS_ORIGINS` |
| R2 credentials, later | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` |
| Brevo credentials, later | `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` |

Secrets must not be committed. Production and preview environments should use separate Paystack and database configuration where practical.

## Deployment Risks

| Risk | Mitigation |
| --- | --- |
| Raw webhook body handling behind deployed backend | Configure NestJS raw body handling specifically for Paystack webhook route. Test deployed webhook signature verification. |
| CORS misconfiguration | Allow only known frontend origins. Keep local/dev origins separate. |
| Environment variable mismatch | Maintain documented env examples without secrets and verify during deployment. |
| Database migration order | Run migrations before deploying code that depends on new schema. |
| Paystack callback/webhook URL mismatch | Use deployed backend URL for webhooks and deployed frontend URL for callbacks. |
| Free-tier cold starts | Mention in portfolio docs if first request is slow. Consider platform with acceptable wake time. |
| Seed data handling | Keep demo seed command explicit and avoid running destructive seeds against production data unintentionally. |
| Secure cookie/auth behaviour across domains | Configure cookie domain, secure flag, SameSite, HTTPS, and CORS credentials consistently. |

## Deployment Sequence

1. Provision Neon PostgreSQL.
2. Configure backend environment variables.
3. Deploy backend.
4. Run migrations.
5. Configure Paystack test webhook URL.
6. Deploy frontend with API URL and Paystack public key.
7. Run seed data only in the intended demo environment.
8. Smoke test login, dashboard, public invoice, payment initialization, webhook processing, receipt, and export.

## Portfolio Documentation

Final portfolio docs should include:

- What the product does.
- MVP scope and non-goals.
- Architecture summary.
- Demo credentials.
- Test payment instructions.
- Known limitations.
- Security notes for tenant isolation, RBAC, and webhook verification.

## Trade-Offs

- Vercel plus a separate API host adds CORS and cookie complexity but keeps Next.js deployment simple.
- A single full-stack host could reduce domain complexity but may be less portfolio-standard for Next.js plus NestJS.
- Paystack test mode is sufficient for MVP credibility without handling live money.
