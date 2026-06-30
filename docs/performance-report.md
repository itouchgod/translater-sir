# Performance Report

Date: 2026-06-30

## Scope

T27 covers query indexes, N+1 checks, short Redis caches, chart bundle splitting, image remote pattern hardening, and an API latency script.

## Database Indexes

Migration: `prisma/migrations/0007_performance_indexes/migration.sql`

Added indexes:

- `Meeting_organizationId_createdAt_id_idx` for meeting list queries:
  `WHERE organizationId = ? ORDER BY createdAt DESC, id DESC`
- `MeetingSegment_meetingId_sequence_idx` for subtitle history:
  `WHERE meetingId = ? ORDER BY sequence`
- `AiLog_createdAt_id_idx` for analytics windows:
  `WHERE createdAt BETWEEN ? AND ?`
- `AuditLog_userId_createdAt_id_idx` for audit log user filters:
  `WHERE userId = ? ORDER BY createdAt DESC`

The migration uses `CREATE INDEX IF NOT EXISTS` so it can run safely on databases that already have equivalent Prisma-generated indexes.

## N+1 Review

- `GET /api/meetings` uses one Prisma `findMany` with `include` for `_count` and recent files.
- `GET /api/admin/users` uses `_count` for memberships, meetings, and AI logs.
- `GET /api/dictionaries/:id/terms` runs term page and count queries in parallel with `Promise.all`.

## Cache Changes

- `GET /api/users/me`: Redis TTL 60s, invalidated on profile/avatar/account changes.
- `GET /api/organizations/:id`: Redis TTL 60s for organization public fields only; `currentMember` remains per-request.
- `GET /api/billing/current`: Redis TTL 300s, invalidated on Stripe subscription sync/cancel/payment failure.

## Frontend Changes

- Dashboard Recharts payload moved to `DashboardCharts` and loaded via `dynamic(..., { ssr: false })`.
- `next/image` remote patterns now explicitly include the `R2_PUBLIC_URL` origin when configured.
- Meeting create/delete routes call `revalidateTag(CacheTags.meetings(orgId))`, `revalidatePath("/meetings")`, and `revalidatePath("/dashboard")`.

## Local Smoke Data

Environment:

- Base URL: `http://localhost:3001`
- Auth cookie: not provided
- OpenAI key / full test meeting: not provided
- Requests per endpoint: 5
- Request timeout: 2000ms

Command:

```bash
PERF_BASE_URL=http://localhost:3001 PERF_REQUESTS=5 PERF_TIMEOUT_MS=2000 pnpm exec ts-node --compiler-options '{"module":"CommonJS"}' scripts/perf-test.ts
```

Results:

| Endpoint | Requests | P50 | P95 | P99 | Statuses |
| --- | ---: | ---: | ---: | ---: | --- |
| GET /api/meetings | 5 | 98.98ms | 1097.07ms | 1097.07ms | 401: 5 |
| GET /api/dashboard/stats | 5 | 98.85ms | 258.09ms | 258.09ms | 401: 5 |
| POST /api/translate | 5 | 1160.24ms | 2004.86ms | 2004.86ms | 0: 1, 503: 4 |

The smoke run verifies the script and timeout behavior. A representative authenticated run should use:

```bash
PERF_BASE_URL=https://your-app.example.com \
PERF_AUTH_COOKIE='next-auth.session-token=...' \
PERF_MEETING_ID='...' \
PERF_REQUESTS=100 \
pnpm exec ts-node --compiler-options '{"module":"CommonJS"}' scripts/perf-test.ts
```
