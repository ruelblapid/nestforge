---
name: nest-api-dev
description: Use this skill when working on this NestJS project's codebase, whether implementing a new endpoint/domain, fixing a bug, changing the Prisma schema, or modifying existing API behavior. Trigger on requests like "add an endpoint", "add a resource", "fix the login bug", "add a column", or any code change in this repo. Ensures new code follows the project's layered architecture, nestforge conventions, testing requirements and commit style, and keeps feature docs in sync with what is actually implemented.
---

# Nest API Dev

Keeps every code change in this repo consistent with the architecture, style, testing
standards and commit conventions, and keeps the feature docs truthful.

## Before making any change

Load what is relevant to the task:

- `references/architecture.md`: always, for any code change (layers, dependency rule,
  per-domain recipe)
- `references/stack.md` and `references/code-style.md`: always, for any code change
- `references/domain-pattern.md`: new or changed entity, error, or repository interface
- `references/repositories-pattern.md`: anything under `src/infrastructure/repositories`
- `references/services-pattern.md`: anything under `src/application`
- `references/controllers-and-schemas-pattern.md`: anything under `src/api`
- `references/auth-pattern.md`: login, tokens, roles, guards, social sign-in
- `references/database-and-migrations.md`: any edit to `prisma/schema.prisma`
- `references/config-and-env.md`: any new or changed environment variable
- `references/observability-and-ops.md`: health, metrics, logging, Swagger, Docker
- `references/testing-conventions.md`: before writing tests
- `references/commit-convention.md`: before committing anything
- `references/new-project-setup.md`: when this template was just copied into a new project
- `references/features/<feature-name>.md`: when the task touches a documented feature

If the task touches a feature that is not yet documented in `references/features/`, that is
fine. Implement it, then create the doc afterward (see "Documenting a new feature").

## Direction (the process)

### 1. Understand what is being asked

New feature, or a change to an existing one? They are handled differently (below). Check
`references/features/` for a matching file first, and check the actual code, since code is the
source of truth over docs if the two disagree.

### 2. Building a new feature or domain

1. Read `architecture.md`, `stack.md` and `code-style.md`.
2. Open 2 or 3 similar existing files (start with `Profile`: `src/domain/profile.ts`,
   `src/infrastructure/repositories/profile.repository.ts`, `src/application/profile.service.ts`,
   `src/api/controllers/profile.controller.ts`) and confirm the docs still match reality.
3. Follow the per-domain recipe in `architecture.md`, layer by layer, domain first and api last.
4. Write tests per `testing-conventions.md` (unit test with fakes for the service; e2e for the
   HTTP behavior and anything database-specific).
5. Run `scripts/run_tests.sh`. For repository, schema, auth or controller changes also run
   `RUN_E2E=1 scripts/run_tests.sh` with the compose database up and migrated.
6. Create `references/features/<feature-name>.md` (template below).
7. Commit following `commit-convention.md`.

### 3. Modifying an existing feature

1. Read the current code first. It is the source of truth; the doc may be stale.
2. Read the matching `references/features/<feature-name>.md`.
3. Apply only the requested change. Do not refactor unrelated code in the same pass unless asked.
4. Update the tests affected by the change and run `scripts/run_tests.sh`.
5. Update the feature doc: edit only the sections that changed and append a line to its Changelog.
6. Commit following `commit-convention.md`.

### 4. Changing the database

1. Edit `prisma/schema.prisma`, then `pnpm db:migrate:dev --name <what_changed>`.
2. Read the generated SQL. Hand-edit it when a unique constraint must be partial (live rows only).
3. Commit the schema and the migration together. Never edit an applied migration.
4. Add the new table to the e2e `TRUNCATE` list.

### 5. Documenting a new feature

Use this shape for any new `references/features/<name>.md`:

```markdown
# Feature: <name>

## Behavior

- Each route, who may call it, what it returns, and the status codes it can produce

## States and errors

- The failure cases (400/401/403/404/409) and what triggers each

## Out of scope (for now)

- What this explicitly does NOT do yet, so it is not re-litigated later

## Changelog

- YYYY-MM-DD: initial implementation
```

## Done looks like

Code that matches `code-style.md` and the layer rules, `scripts/run_tests.sh` passing, a commit
message following `commit-convention.md`, and a feature doc that reflects current behavior, not
what it used to do.
