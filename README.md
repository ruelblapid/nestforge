# nestforge

Monorepo with two parts:

- `packages/nestforge` – ORM-agnostic core for NestJS: `Either`, value objects, query/filter/sort/paging engine, Zod pipes, exception filter, `EitherInterceptor`, repository/cache/storage interfaces.
- `templates/starter` – runnable Nest app built on the package: email/password auth (JWT + rotating refresh tokens), profiles, TypeORM/Postgres, roles, throttling, health check. Plain services, no CQRS.

## Quick start

```sh
pnpm install
pnpm --filter nestforge build          # the starter consumes the built package
cd templates/starter
cp .env.example .env                   # then edit secrets / DATABASE_URL
docker compose up -d --wait            # local Postgres matching .env.example
pnpm start:dev                         # applies pending migrations outside production
```

`pnpm test` and `pnpm typecheck` at the root run both projects. End-to-end tests (real Postgres, full HTTP stack) are separate: with the compose database up and migrated (`pnpm migration:run`), run `pnpm --filter nestforge-starter test:e2e`. They truncate the `auths`/`profiles` tables, so don't point them at data you care about.

## Starter conventions

- `domain/` – plain entities with factories returning `Either`, repository interfaces. No Nest/TypeORM imports.
- `application/` – services that orchestrate use cases and return `Result<T>` (`Either<DataError, T>`).
- `api/` – controllers, Zod schemas, guards. Controllers return the `Either`; `EitherInterceptor` unwraps it.
- `infrastructure/` – TypeORM entities, repositories, unit of work (one DB transaction for register).
- Routes are protected by default; use `@Public()` to open one, `@Roles(Role.ADMIN)` to restrict.

## Social sign-in

`POST /api/auth/google` and `POST /api/auth/apple` take `{ idToken, nonce? }` (Apple also `firstName?`, `lastName?`). Set `GOOGLE_CLIENT_IDS` / `APPLE_CLIENT_IDS` (comma-separated audiences); an empty value disables that provider. Tokens are verified against the provider's JWKS with `jose`. An existing account is linked by email only when the provider reports the email as verified.

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

In production the container does not migrate on start. Run the same image once per deploy with the command used by the compose `migrate` service (`node node_modules/typeorm/cli.js migration:run -d dist/infrastructure/data-source.js`) before rolling out the API. `DATABASE_SSL` controls TLS to Postgres (default: on in production).

## Request id and logging

Every request gets an `X-Request-Id` (a safe incoming value is kept, otherwise a UUID is generated) and one log line on completion: method, path (no query string), status, duration, id and user id. `/health` is not logged.

## Migrations

Schema changes go through TypeORM migrations in `src/infrastructure/migrations` (`synchronize` is off). Outside production they run on app start; in production run them explicitly.

```sh
pnpm migration:generate src/infrastructure/migrations/AddSomething   # diff entities vs. DB
pnpm migration:run
pnpm migration:revert
```

## Query endpoints

`@QuerySchema({...})` on a handler plus `@Params()` on its parameter validates `filter[...]`, `sort`, `page[...]` and returns a 400 listing every violation. See `ProfileController.list`.

## Not done yet

Google/Apple authorization-code (PKCE) and web redirect flows.
