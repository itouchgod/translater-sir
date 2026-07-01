# Cloudflare Setup

Updated: 2026-07-01

Production domain: `https://www.translatersir.com`

The app is currently positioned as an internal company simultaneous interpretation tool. Cloudflare is used for DNS/CDN behavior and R2 object storage; Vercel remains the application runtime.

## DNS

1. Add the production domain to Vercel.
2. In Cloudflare DNS, create a `CNAME` record for the app host:
   - Name: `app` or `@`
   - Target: `cname.vercel-dns.com`
   - Proxy status: Proxied
3. Keep `NEXT_PUBLIC_APP_URL` and `NEXTAUTH_URL` aligned with the final HTTPS URL.
4. Use Cloudflare SSL/TLS mode `Full (strict)` after Vercel has issued the certificate.

Current canonical app URL:

```env
NEXTAUTH_URL=https://www.translatersir.com
NEXT_PUBLIC_APP_URL=https://www.translatersir.com
```

## R2

Current bucket and public URL:

```env
R2_ACCOUNT_ID=96b38e3d16f403104f1535e4710e0410
R2_BUCKET_NAME=translater-sir
R2_PUBLIC_URL=https://pub-4ad191e6ae9341e3b9b302af4b0023bb.r2.dev
```

R2 API token requirements:

- Token name: `translater-sir`
- Permission: `Object Read & Write`
- Bucket scope: `translater-sir`
- Store `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` in Vercel Production / Preview.
- Store the same values in `.env.local` only when local R2 testing is needed.

If the token is deleted, recreate it with the same permission and bucket scope, update Vercel env vars, redeploy, then verify:

```bash
curl https://www.translatersir.com/api/health/r2
```

Expected result: `status` is `ok`.

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

Latest verified state on 2026-07-01:

- `/api/health`: `overall` is `healthy`
- `/api/health/r2`: `status` is `ok`
