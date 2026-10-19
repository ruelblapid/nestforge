# CLAUDE.md

This project is a NestJS API built on the `nestforge` package. It uses a layered, DDD-lite architecture (domain, application, api, infrastructure) with Prisma + Postgres, Zod validation and `Either` results. Every convention is documented in full under `.claude/`.

**Before writing any code, read `.claude/SKILL.md` (the workflow) and `.claude/references/architecture.md` (the index into everything else).** Then follow whichever doc matches what you are building:

- Starting a brand new project from this template (rename, `nestforge` git dependency, Docker, secrets): `new-project-setup.md`
- Layers, dependency rule, request flow, the per-domain recipe: `architecture.md`
- Entities, error helpers, repository interfaces: `domain-pattern.md`
- Prisma repositories, soft delete, unit of work: `repositories-pattern.md`
- Use cases / services: `services-pattern.md`
- Controllers, Zod schemas, Swagger, list/filter endpoints: `controllers-and-schemas-pattern.md`
- Authentication, roles, tokens, social sign-in: `auth-pattern.md`
- Schema changes and migrations: `database-and-migrations.md`
- Environment variables: `config-and-env.md`
- Tests (Vitest, in-memory fakes, e2e against Postgres): `testing-conventions.md`
- Health, metrics, request ids, Swagger, Docker: `observability-and-ops.md`
- Formatting, naming, exports, error handling: `code-style.md`
- What the stack actually is: `stack.md`
- Commit messages: `commit-convention.md`
- Features that already exist (behavior, states, out of scope): `.claude/references/features/`

All paths above are relative to `.claude/references/`.

## Commands

```sh
pnpm install                      # also runs `prisma generate` (postinstall)
docker compose up -d --wait       # local Postgres matching .env.example
pnpm db:migrate                   # apply committed migrations
pnpm start:dev                    # watch mode, API on :4000, Swagger at /docs

pnpm typecheck                    # tsc --noEmit
pnpm test                         # unit tests (no database needed)
pnpm test:e2e                     # full HTTP stack, needs the compose database, TRUNCATEs tables

.claude/scripts/run_tests.sh      # architecture check + typecheck + unit tests (RUN_E2E=1 adds e2e)
```

## Rules

1. These MD files are the source of truth for this project's conventions. Do not fall back to generic NestJS patterns (class-validator DTOs, TypeORM, throwing Nest exceptions for expected failures, per-feature modules) or invent a different architecture.
2. The existing `Profile` and `Auth` code is the worked example for every pattern. Adapt the pattern to the domain you are building; do not copy names like `Profile`/`authId` verbatim.
3. If code and docs disagree, the code wins. Fix the doc in the same change.
4. If a doc's pattern genuinely does not fit a new situation, say so and ask. Do not silently deviate.
5. Never run `prisma migrate reset` or `prisma db push`, never edit a migration that has already been applied, never commit `.env`, never log tokens, passwords or hashes.
6. Do not add an npm dependency for something solvable in a few lines. Ask first if it is not obvious.
7. A change is not done until `.claude/scripts/run_tests.sh` passes (and `pnpm test:e2e` too when you touched repositories, the Prisma schema, auth or controllers).
