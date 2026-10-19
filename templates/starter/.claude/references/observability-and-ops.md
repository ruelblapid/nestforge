# Observability and Ops

## Health

`GET /health` (no `/api` prefix, `@Public()`, `@SkipThrottle()`) runs a Terminus check that does
`SELECT 1` through `PrismaHealthIndicator`. Add new dependency checks as indicators in
`infrastructure/` and list them in `HealthController.check`. Probes are not logged or measured.

## Metrics

`GET /metrics` serves Prometheus text: default Node metrics plus
`http_request_duration_seconds{method,route,status_code}`.

- `route` is the matched **pattern** (`/api/profiles/me`), and `unmatched` otherwise, so label
  cardinality stays bounded. Never put raw URLs, ids or user data in labels.
- `METRICS_TOKEN` (16+ chars) requires `Authorization: Bearer <token>`, compared in constant
  time. Empty means open; restrict it at the network level.
- `MetricsService` owns its own `Registry` (not the global one) so tests can create several apps.
- Add a metric by adding it to `MetricsService` with a small method; do not scatter `prom-client`
  calls around the codebase.

## Request id and logging

`RequestContextMiddleware` assigns `X-Request-Id` (keeps a safe incoming value matching
`^[A-Za-z0-9._-]{1,64}$`, otherwise a UUID) and writes one line per finished request:
`METHOD path status ms id=<id> user=<userId>`.

- Path only. No query string (it can carry filter values).
- Level by status: 5xx error, 4xx warn, else log.
- `/health` and `/metrics` are excluded in `AppModule.configure`.

## Swagger

UI at `/docs`, JSON at `/docs-json`. On outside production; in production only when
`SWAGGER_ENABLED=true`. Body schemas come from the Zod schemas via `bodySchema(schema)` in
`api/swagger.ts`, so docs cannot drift from validation. Update the title and description in
`setupSwagger` when this template becomes a real project.

## Docker

Multi-stage `Dockerfile` with two deployable targets:

| Target | Purpose |
| --- | --- |
| `runtime` | the API. Production tree pruned of the Prisma CLI (`scripts/prune-pnpm-store.mjs`), runs as the unprivileged `node` user, `node dist/main.js` |
| `migrate` | one-shot `prisma migrate deploy` |

Production flow: run `migrate` once per deploy, then roll out `runtime`. The API never migrates
on start. `DATABASE_SSL` controls TLS to Postgres (default on in production).

`docker-compose.yml` runs local Postgres by default. The `app` profile also builds and runs
`migrate` then `api` against it:

```sh
JWT_SECRET=<32+ chars> JWT_REFRESH_SECRET=<32+ chars> docker compose --profile app up --build
```

Keep the compiled app's layout: `dist/` next to `generated/` (the code finds the Prisma client
at `../../generated/prisma` from `dist/infrastructure/prisma`).

When this template lives in a standalone repo instead of the nestforge monorepo, the Dockerfile
and compose build context need adjusting. See `new-project-setup.md`.

## CI expectations

On every PR: install with a frozen lockfile, build, typecheck, unit tests, then a job with a
Postgres service that applies migrations and checks schema/migration drift. Mirror that in a
new project (copy the workflow from the nestforge repo and adjust the paths).
