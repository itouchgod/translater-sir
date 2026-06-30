# Cloudflare Setup

## DNS

1. Add the production domain to Vercel.
2. In Cloudflare DNS, create a `CNAME` record for the app host:
   - Name: `app` or `@`
   - Target: `cname.vercel-dns.com`
   - Proxy status: Proxied
3. Keep `NEXT_PUBLIC_APP_URL` and `NEXTAUTH_URL` aligned with the final HTTPS URL.
4. Use Cloudflare SSL/TLS mode `Full (strict)` after Vercel has issued the certificate.

## Cache Rules

Create rules in this order:

1. API routes are never cached:
   - Expression: `(http.request.uri.path wildcard "/api/*")`
   - Cache eligibility: Bypass cache
2. Next.js static assets are cached for one year:
   - Expression: `(http.request.uri.path wildcard "/_next/static/*")`
   - Browser TTL: 1 year
   - Edge TTL: 1 year
3. R2 public files can be cached when immutable file keys are used:
   - Expression: host equals the R2 public asset host
   - Browser TTL: 1 day to 1 year, based on file replacement policy

Do not cache authenticated pages, `/api/*`, Stripe webhook routes, or SSE endpoints.

## WAF

Recommended custom rules:

- Challenge obvious automated traffic with very high request rates to `/api/auth/*`.
- Block requests with known malicious user agents or empty user agents on API paths.
- Challenge countries or ASNs that are not expected for the product audience if abuse appears.
- Add a stricter rule for `/api/webhooks/stripe` that only allows Stripe source IPs when the operational process can keep Stripe IP ranges current. Signature verification remains mandatory either way.
- Keep Cloudflare Bot Fight Mode compatible with Vercel and Stripe webhook delivery before enabling it globally.

## Headers And Forwarded IP

The app reads `x-forwarded-for` for audit logs and rate limiting. With Cloudflare in front of Vercel, confirm Vercel receives the original client IP in forwarded headers and that Cloudflare does not strip them.

## Health Checks

Use `/api/health` for uptime checks. It returns:

- `overall`: `healthy`, `degraded`, or `down`
- `components.db.latencyMs`
- `components.redis.latencyMs`
- `components.r2.latencyMs`

Set the monitor timeout high enough for R2 health upload/delete operations, typically 5-10 seconds.
