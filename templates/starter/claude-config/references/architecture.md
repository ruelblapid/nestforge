# Architecture

Layered, DDD-lite. Plain services, no CQRS, no event bus. Built on the `nestforge` package
(`Either`, `DataError`, `ZodValidationPipe`, `EitherInterceptor`, `ApiExceptionFilter`,
`@QuerySchema`/`@Params`, `buildPrismaQuery`).

## Layers and the dependency rule

```
src/
  domain/          entities, enums, error helpers, repository INTERFACES + DI tokens
  application/     services (use cases), ports for external systems (identity verifier, OAuth clients)
  api/             controllers, Zod schemas, guards/decorators, middleware, Swagger
  infrastructure/  Prisma, repository IMPLEMENTATIONS, unit of work, jose/OAuth adapters, metrics, health
  config/          env.ts (the only reader of process.env)
  app.module.ts    one flat module that wires everything
  main.ts          bootstrap
```

| Layer | May import | Must NOT import |
| --- | --- | --- |
| `domain` | `uuid`, `nestforge` (Either/DataError/IParameters) | `@nestjs/*`, `@prisma/*`, `generated/prisma`, `config/env`, `express`, application, api, infrastructure |
| `application` | domain, `config/env`, `@nestjs/common` (`Injectable`, `Inject`), `@nestjs/jwt`, `bcrypt`, `node:crypto`, `nestforge` | api, infrastructure, `@prisma/*`, `generated/prisma`, `express` |
| `infrastructure` | domain, application ports, Prisma, `config/env`, `jose` | api |
| `api` | application, domain (enums/types), `@nestjs/*`, `nestforge` | `generated/prisma`, `domain/repositories`; `infrastructure` only for operational endpoints (health, metrics, request-context middleware) |

`.claude/scripts/check_architecture.sh` enforces this. Run it (via `run_tests.sh`) before you
call a change done.

Why it matters: services depend on interfaces (`IProfileRepository`), so unit tests swap in
in-memory fakes and the database stays an infrastructure detail.

## Request flow

```
HTTP
 -> RequestContextMiddleware   request id, one log line, duration metric
 -> ThrottlerGuard             rate limit
 -> JwtAuthGuard               401 unless @Public()
 -> RolesGuard                 403 unless the user has a role listed in @Roles()
 -> ZodValidationPipe          400 with every violation listed
 -> Controller                 one line: call a service, return its Either
 -> Service                    orchestrates entities + repositories, returns Result<T>
 -> Repository (interface)     Prisma implementation, maps rows <-> entities
EitherInterceptor unwraps Right, throws ApiException for Left.
ApiExceptionFilter formats every error as { success, statusCode, message, errorCode?, details?, errors? }.
```

Guard order is fixed in `app.module.ts`: throttle, authenticate, authorize. Do not reorder.

## DI wiring

- One flat `AppModule` lists controllers and services as providers. `DatabaseModule` provides the
  Prisma client, every repository and the unit of work, and exports them.
- Repositories and other ports are injected by **Symbol token**: define
  `export const PROFILE_REPOSITORY = Symbol('PROFILE_REPOSITORY')` next to the interface in
  `domain/repositories/index.ts`, and inject with `@Inject(PROFILE_REPOSITORY)`.
- Services are injected into controllers by class.
- Do not introduce per-feature Nest modules without asking. If the flat module becomes unwieldy,
  raise it first.

## Results, not exceptions

Every expected failure (validation, not found, conflict, unauthorized) is a `Left` of
`DataError` built with the helpers in `domain/errors.ts`. `throw` is for unexpected states only.
Controllers return the `Either`; the global interceptor does the HTTP mapping.

## Per-domain recipe

For a new resource (call it `Thing`), work in this order and keep each step small:

1. **Domain entity** `src/domain/thing.ts`: private constructor, `create` (validates, returns
   `Result`), `restore`, mutators, `toPrimitives`. See `domain-pattern.md`.
2. **Repository interface + token** in `src/domain/repositories/index.ts`. Add it to
   `TransactionalRepositories` if it must join a transaction.
3. **Prisma model + migration**: `prisma/schema.prisma`, then `pnpm db:migrate:dev --name add_things`.
   See `database-and-migrations.md`.
4. **Repository implementation** `src/infrastructure/repositories/thing.repository.ts`
   (soft-delete filter, `toDomain`, `FIELDS` map). Register it in `database.module.ts` (provider
   and export) and in `PrismaUnitOfWork` if transactional. See `repositories-pattern.md`.
5. **Service** `src/application/thing.service.ts` returning `Result<ThingView>`. See
   `services-pattern.md`.
6. **Zod schemas** `src/api/schemas/thing.schemas.ts`, then **controller**
   `src/api/controllers/thing.controller.ts`. Register the controller and service in
   `app.module.ts`. See `controllers-and-schemas-pattern.md`.
7. **Tests**: unit test for the service with fakes in `test/thing.service.spec.ts`; e2e cases in
   `test/e2e/`; add the new table to the `TRUNCATE` list. See `testing-conventions.md`.
8. **Feature doc** `references/features/thing.md`.

## Where does X go?

| I need to... | Put it in |
| --- | --- |
| validate a business rule on one entity | the entity (`domain/`) |
| coordinate two aggregates or call an external system | a service (`application/`) |
| talk to the database | a repository (`infrastructure/repositories/`) |
| call a third party (HTTP, SDK) | a port interface in `application/`, adapter in `infrastructure/` |
| parse/validate a request | a Zod schema (`api/schemas/`) |
| read an env var | `config/env.ts`, then `import { env }` |
| protect a route | `@Roles(...)`; open it with `@Public()` |
