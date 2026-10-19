---
name: review-features
description: Use this skill to review a feature, branch, diff or set of files in this NestJS project against its own standards. Trigger on requests like "review this feature", "review my changes", "check this PR", "does this follow our conventions", or before committing a finished feature. Produces a prioritized list of findings with file and line, verified against the real code and the checks in .claude/scripts. Reports only; does not change code unless asked.
---

# Review Features

A review against THIS project's rules (`.claude/references/`), not generic taste. Findings must be
verified in the code. Do not report something you did not read.

## 1. Scope the review

Decide what is being reviewed, in this order:

1. Files or a feature the user named.
2. The working changes: `git status` and `git diff` (staged and unstaged).
3. The branch against its base: `git diff <base>...HEAD` (usually `main`).

State the scope in one line at the top of the review. If there is nothing to review, say so.

## 2. Load the standards

Always read `.claude/references/architecture.md` and `code-style.md`. Then read the pattern doc
for each layer the diff touches:

| Touched | Read |
| --- | --- |
| `src/domain` | `domain-pattern.md` |
| `src/infrastructure/repositories`, `unit-of-work.ts`, `database.module.ts` | `repositories-pattern.md` |
| `src/application` | `services-pattern.md` |
| `src/api` | `controllers-and-schemas-pattern.md` |
| auth, roles, tokens, guards | `auth-pattern.md` |
| `prisma/` | `database-and-migrations.md` |
| `src/config`, `.env.example` | `config-and-env.md` |
| `test/` | `testing-conventions.md` |

## 3. Run the mechanical checks

```sh
bash .claude/scripts/run_tests.sh
```

Add `RUN_E2E=1` (compose database up and migrated) when repositories, the Prisma schema, auth or
controllers changed. Report the result honestly: if a check cannot run (no database, no
dependencies installed), say it was not run instead of assuming it passes.

## 4. Review checklist

Check each item that applies to the diff.

**Architecture**
- Layer imports follow the dependency rule (the script catches most; also look for logic in the
  wrong layer: business rules in controllers, HTTP types in services, Prisma types leaking out of
  repositories).
- New provider, controller or repository is registered (`app.module.ts`, `database.module.ts`,
  `PrismaUnitOfWork` if transactional).

**Domain and services**
- Expected failures return `fail(...)` with the helpers in `domain/errors.ts`; no `throw` for not
  found, validation, conflict or unauthorized.
- Entities keep a private constructor, `create` validates, `restore` trusts, and normalization
  (trim, lowercase) happens in the entity.
- Services return views (`toPrimitives()`), never entities or anything carrying hashes or secrets.
- Multi-aggregate writes use the unit of work, and `UniqueViolationError` is mapped to a conflict.
- Self-service actions take the user id from the token, never from the body.

**Repositories and database**
- Every read applies `LIVE` (`deletedAt: null`); `softDelete` instead of delete; `findFirst`, not
  `findUnique`.
- `FIELDS` map matches the controller's `@QuerySchema`.
- Schema change comes with its migration; partial unique indexes kept; new table added to the
  e2e `TRUNCATE` list; destructive changes called out.

**API**
- Every `@Body()`/`@Query()` uses `ZodValidationPipe`; schemas are `z.strictObject` with bounds.
- Route protection is deliberate: no accidental `@Public()`, `@Roles` where admin-only.
- Status codes (201/200/204), `@ApiTags`, `@ApiBody(bodySchema(...))`, `@ApiBearerAuth`, and
  `@Throttle` on credential-style routes.

**Tests**
- Unit test for new service logic with fakes; e2e for HTTP behavior and database behavior.
- Unhappy paths covered (404, 400, 401/403, 409, replay of single-use things).
- No weakened or deleted assertions to get green.

**Docs and hygiene**
- `.claude/references/features/<name>.md` created or updated, with a Changelog line.
- New env vars are in `env.ts` and `.env.example`.
- No debug logging, commented-out code, unrelated reformatting or unexplained new dependency.
- Commit message (if one exists) follows `commit-convention.md`.

For anything touching auth, new public routes, raw SQL, env or user input, also run the
`security-check` skill and link its findings instead of duplicating them.

## 5. Report

Use this shape:

```markdown
## Review: <scope>

**Verdict:** ready / ready after fixes / needs rework (one sentence why)
**Checks:** run_tests.sh <passed/failed/not run>, e2e <passed/failed/not run>

### Blockers (must fix)
1. `path/file.ts:42` What is wrong, which rule it breaks (doc name), and the concrete fix.

### Should fix
1. ...

### Nits
1. ...

### Looks good
- One or two lines on what was done well, only if true.
```

Rules for the report:
- Every finding has `file:line`, the rule it violates, and a suggested fix.
- Order by severity: security or data-loss or broken behavior first, then convention breaks,
  then style.
- No findings padding. An empty section is omitted, and a clean review says so plainly.
- If a doc and the code disagree, say which one looks wrong and propose the fix.
- Do not edit code during a review. Offer to apply the fixes afterward.
