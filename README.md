# nestforge

Monorepo with two parts:

- `packages/nestforge` – ORM-agnostic core for NestJS: `Either`, value objects, query/filter/sort/paging engine, Zod pipes, exception filter, `EitherInterceptor`, repository/cache/storage interfaces.
- `templates/starter` – runnable Nest app built on the package: email/password auth (JWT + rotating refresh tokens), profiles, Prisma/Postgres, roles, throttling, health check. Plain services, no CQRS.

## Quick start

```sh
pnpm install
pnpm --filter nestforge build          # the starter consumes the built package
cd templates/starter
cp .env.example .env                   # then edit secrets / DATABASE_URL
docker compose up -d --wait            # local Postgres matching .env.example
pnpm db:migrate                        # create the tables (prisma migrate deploy)
pnpm start:dev
```

`pnpm test` and `pnpm typecheck` at the root run both projects. End-to-end tests (real Postgres, full HTTP stack) are separate: with the compose database up and migrated (`pnpm db:migrate`), run `pnpm --filter nestforge-starter test:e2e`. They truncate the `auths`/`profiles` tables, so don't point them at data you care about.

## Starter conventions

- `domain/` – plain entities with factories returning `Either`, repository interfaces. No Nest/Prisma imports.
- `application/` – services that orchestrate use cases and return `Result<T>` (`Either<DataError, T>`).
- `api/` – controllers, Zod schemas, guards. Controllers return the `Either`; `EitherInterceptor` unwraps it.
- `infrastructure/` – Prisma client, repositories (they map rows to domain objects and filter out soft-deleted rows), unit of work (one DB transaction for register).
- Routes are protected by default; use `@Public()` to open one, `@Roles(Role.ADMIN)` to restrict.

## Social sign-in

Three ways in, all ending in the same access/refresh token pair. Every provider token is verified against the provider's JWKS with `jose` (signature, issuer, audience, nonce). An existing account is linked by email only when the provider reports the email as verified.

`GOOGLE_CLIENT_IDS` / `APPLE_CLIENT_IDS` (comma-separated) are the accepted audiences; an empty value disables that provider. **The first ID is the "web" client** used by the redirect flow.

| Flow | Use it when | Endpoints |
| --- | --- | --- |
| ID token | The client already has an ID token (Google/Apple native SDKs) | `POST /api/auth/google`, `POST /api/auth/apple` with `{ idToken, nonce? }` (Apple also `firstName?`, `lastName?`) |
| Client-side code exchange (PKCE) | Mobile / SPA runs the authorization-code flow itself | `POST /api/auth/{google,apple}/code` with `{ code, codeVerifier?, redirectUri?, clientId?, nonce?, firstName?, lastName? }` |
| Browser redirect | A web app wants the API to run the whole flow | `GET /api/auth/{google,apple}/start`, then the web app calls `POST /api/auth/exchange` with `{ code }` |

**Client-side exchange.** The API swaps the code for an ID token at the provider and signs the user in. `clientId` must be one of the configured IDs (default: the web client); the web client's secret is only ever sent for the web client. For Google, send the PKCE `codeVerifier`; Apple's token endpoint has no PKCE.

**Browser redirect.** `start` redirects to the provider and sets a signed, HTTP-only `oauth_state` cookie holding the state, nonce and PKCE verifier. The provider returns to `/api/auth/<provider>/callback` (Google by GET, Apple by `form_post`), the API checks cookie and state, exchanges the code, signs the user in, and redirects the browser to `WEB_LOGIN_REDIRECT_URL` with `?code=<one-time code>` or `?error=<reason>`. The web app then trades the code at `POST /api/auth/exchange`. Tokens never appear in a URL; the code lives 60 seconds, works once, and is stored only as a hash. Errors: `invalid_state`, `access_denied`, `exchange_failed`, `email_conflict`, `sign_in_failed`.

Setup for the redirect flow:

- `OAUTH_PUBLIC_URL`: public base URL of this API. Register `<OAUTH_PUBLIC_URL>/api/auth/google/callback` and `<OAUTH_PUBLIC_URL>/api/auth/apple/callback` as redirect URIs with the providers. Apple requires HTTPS (and a verified domain).
- `WEB_LOGIN_REDIRECT_URL`: your frontend page that reads `code` / `error`. It is fixed in config, never taken from the request, so it cannot be used as an open redirect.
- Google: `GOOGLE_CLIENT_SECRET` for the web client.
- Apple: the web client ID is your **Services ID**; also set `APPLE_TEAM_ID`, `APPLE_KEY_ID` and `APPLE_PRIVATE_KEY` (the `.p8` contents; a literal `\n` between lines is accepted). The API signs Apple's short-lived client-secret JWT itself.

The redirect routes answer 400 until all of the above are set for that provider; the other two flows only need the client IDs.

## API docs (Swagger)

Swagger UI is served at `/docs` (JSON at `/docs-json`) and lists every route; request body schemas are generated from the same Zod schemas that validate them. It is on outside production and off in production unless `SWAGGER_ENABLED=true`. Use **Authorize** with an access token from `/api/auth/login`.

## Metrics (Prometheus)

`GET /metrics` serves Prometheus text format: default Node/process metrics plus `http_request_duration_seconds{method,route,status_code}`. `route` is the matched pattern (e.g. `/api/profiles/me`), and anything unmatched is `unmatched`, so label cardinality stays bounded. `/health` and `/metrics` are not recorded. Set `METRICS_TOKEN` (16+ chars) to require `Authorization: Bearer <token>`; with it empty the endpoint is open, so restrict it at the network level.

```yaml
scrape_configs:
  - job_name: nestforge-starter
    authorization: { credentials: <METRICS_TOKEN> }
    static_configs: [{ targets: ['localhost:4000'] }]
```

## Docker

The image is built from the repository root because the starter depends on the workspace package:

```sh
docker build -f templates/starter/Dockerfile -t nestforge-starter .
```

To try the image against the compose database (applies migrations first, then starts the API on :4000):

```sh
cd templates/starter
JWT_SECRET=<32+ chars> JWT_REFRESH_SECRET=<32+ chars> docker compose --profile app up --build
```

The Dockerfile has two targets: `runtime` (the API; no Prisma CLI, so it stays small) and `migrate` (runs `prisma migrate deploy`). In production the API does not migrate on start: run the `migrate` image once per deploy, before rolling out the API (`docker build --target migrate -f templates/starter/Dockerfile .`). `DATABASE_SSL` controls TLS to Postgres (default: on in production).

## Request id and logging

Every request gets an `X-Request-Id` (a safe incoming value is kept, otherwise a UUID is generated) and one log line on completion: method, path (no query string), status, duration, id and user id. `/health` is not logged.

## Database and migrations

Prisma, with the schema in `prisma/schema.prisma` and SQL migrations in `prisma/migrations`. The client is generated into `generated/prisma` (gitignored) by `pnpm install` (`postinstall`) or `pnpm db:generate`. The app never changes the schema itself.

```sh
pnpm db:migrate:dev --name add_something   # edit the schema, then create + apply a migration (development)
pnpm db:migrate                            # apply committed migrations (CI, production)
pnpm db:studio                             # browse the data
```

Things to know:

- **Soft delete is manual.** Prisma has none built in; the repositories add `deletedAt: null` to every read. New queries must do the same.
- **Partial unique indexes are hand-written.** `auths.email`, `google_id`, `apple_id` and `profiles.auth_id` are unique only among live rows (a deleted user's email can be registered again). Prisma cannot express the `WHERE`, so the schema declares plain `@@unique`s and the init migration creates them partial under the same names. If you regenerate or squash migrations, keep the `WHERE` clauses. Never use `findUnique` on those fields.
- **CI checks drift** with `prisma migrate diff --from-migrations ... --to-schema ... --exit-code` against a shadow database (set `SHADOW_DATABASE_URL` to run it locally).
- **Query values are typed.** The query engine delivers filter values as strings and Prisma rejects a string where an `Int` or `DateTime` is expected, so `ProfileRepository` coerces each filter value to its field's type (and drops values that do not parse). `contains` filters escape `%` and `_`.

## Query endpoints

`@QuerySchema({...})` on a handler plus `@Params()` on its parameter validates `filter[...]`, `sort`, `page[...]` and returns a 400 listing every violation. See `ProfileController.list`.

## Not done yet

Nothing planned. Candidates: account unlinking, an admin-creation endpoint, per-user session listing/revocation.
