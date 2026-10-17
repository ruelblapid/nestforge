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
pnpm start:dev
```

`pnpm test` and `pnpm typecheck` at the root run both projects.

## Starter conventions

- `domain/` – plain entities with factories returning `Either`, repository interfaces. No Nest/TypeORM imports.
- `application/` – services that orchestrate use cases and return `Result<T>` (`Either<DataError, T>`).
- `api/` – controllers, Zod schemas, guards. Controllers return the `Either`; `EitherInterceptor` unwraps it.
- `infrastructure/` – TypeORM entities, repositories, unit of work (one DB transaction for register).
- Routes are protected by default; use `@Public()` to open one, `@Roles(Role.ADMIN)` to restrict.

## Social sign-in

`POST /api/auth/google` and `POST /api/auth/apple` take `{ idToken, nonce? }` (Apple also `firstName?`, `lastName?`). Set `GOOGLE_CLIENT_IDS` / `APPLE_CLIENT_IDS` (comma-separated audiences); an empty value disables that provider. Tokens are verified against the provider's JWKS with `jose`. An existing account is linked by email only when the provider reports the email as verified.

## Query endpoints

`@QuerySchema({...})` on a handler plus `@Params()` on its parameter validates `filter[...]`, `sort`, `page[...]` and returns a 400 listing every violation. See `ProfileController.list`.

## Not done yet

Google/Apple authorization-code (PKCE) and web redirect flows, Prometheus metrics, request logging/request-id, Swagger, migrations, Dockerfile/compose.
