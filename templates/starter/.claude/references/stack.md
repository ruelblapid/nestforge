# Stack

What the project actually runs on. Check `package.json` for exact versions.

| Concern | Choice |
| --- | --- |
| Runtime | Node 22 |
| Package manager | pnpm (pinned via `packageManager`, currently 11.2.2). Never npm or yarn. |
| Language | TypeScript 5.9, CommonJS output, target ES2022, decorators + `emitDecoratorMetadata` |
| Type strictness | `strict: false` but `strictNullChecks: true` and `noImplicitAny: true`. Treat null and implicit any as errors. |
| Framework | NestJS 11 on Express (`@nestjs/platform-express`) |
| Core library | `nestforge` (Either/DataError, Zod pipes, exception filter, interceptor, query engine, `buildPrismaQuery`) |
| Validation | Zod 4 (`z.strictObject`, `z.email()`, `z.url()`, `z.toJSONSchema`). No class-validator. |
| Database | PostgreSQL 16 |
| ORM | Prisma 7 with the `@prisma/adapter-pg` driver adapter; client generated into `generated/prisma` (gitignored) |
| Auth | `@nestjs/jwt` + `passport-jwt`, `bcrypt`, `jose` (provider ID token verification) |
| Rate limiting | `@nestjs/throttler` (100 req/min global, tighter per route) |
| API docs | `@nestjs/swagger`, schemas generated from the Zod schemas |
| Health / metrics | `@nestjs/terminus`, `prom-client` |
| Tests | Vitest 3 with `unplugin-swc` (needed for decorator metadata), `supertest`, `@nestjs/testing` |
| Container | Multi-stage Dockerfile (`runtime` and `migrate` targets), `docker-compose.yml` for local Postgres |

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm build` | `nest build` (wipes and rebuilds `dist/`) |
| `pnpm start:dev` | watch mode |
| `pnpm start:prod` | `node dist/main.js` |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | unit tests, `test/**/*.spec.ts` |
| `pnpm test:e2e` | e2e tests, `test/e2e/**/*.e2e-spec.ts`, needs Postgres |
| `pnpm db:generate` | `prisma generate` |
| `pnpm db:migrate` | `prisma migrate deploy` (CI, production, fresh local DB) |
| `pnpm db:migrate:dev` | `prisma migrate dev` (create and apply a migration while developing) |
| `pnpm db:studio` | Prisma Studio |

There is no lint or format script. Follow `code-style.md` by hand; do not add a formatter
config or reformat files you are not otherwise changing.

## Things that are easy to get wrong

- The compiled app finds the Prisma client at `../../generated/prisma` relative to
  `dist/infrastructure/prisma`. Do not move `generated/` or change the Prisma `output`.
- Import the client with a relative path (`'../../../generated/prisma'`), not from `@prisma/client`.
- `nestforge` is consumed as a built package (`dist/`). If you change it in its own repo, rebuild
  it before the app sees the change.
