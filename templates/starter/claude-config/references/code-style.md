# Code Style

Observed from the existing code. Match it; do not "improve" it in passing.

## Formatting

- **Tabs** for indentation, **single quotes**, semicolons, trailing commas in multi-line literals
  and parameter lists, roughly 120 columns.
- Arrow functions for small helpers (`const ok = <T>(value: T): Result<T> => ...`), methods for
  class members.
- Section dividers in long files are plain comments like `// ---- Flow 1: browser redirect ----`.

## TypeScript

- No `any`. Use `unknown` and narrow it, or define a type. Do not add a cast just to silence a real
  type error; fix the type. Narrow, justified casts of library types (for example
  `as Prisma.ProfileWhereInput` on a query built from `buildPrismaQuery`) are the accepted exception.
- **Named exports only.** No `export default` anywhere in `src/` (Nest does not need it).
- Explicit return types on exported functions and public service methods
  (`Promise<Result<AuthTokens>>`).
- Prefer `interface` for object shapes that are implemented or extended, `type` for unions and
  aliases.
- Narrow `null` explicitly; the compiler has `strictNullChecks` on.

## Naming

- **Files:** kebab-case with a role suffix: `profile.service.ts`, `profile.controller.ts`,
  `profile.repository.ts`, `auth.schemas.ts`, `jose-identity-verifier.ts`. Entities and enums are
  plain: `profile.ts`, `role.ts`.
- **Classes:** PascalCase and specific (`ProfileService`, `ProfileRepository`), never `Service`.
- **Interfaces:** `I` prefix matching the concrete class (`IProfileRepository` for
  `ProfileRepository`). Ports implemented in infrastructure use the same rule
  (`IIdentityVerifier` / `JoseIdentityVerifier`).
- **DI tokens:** `SCREAMING_SNAKE` Symbols (`PROFILE_REPOSITORY`, `UNIT_OF_WORK`, `IDENTITY_VERIFIER`).
- **Zod schemas:** `<thing>Schema` plus an inferred `<Thing>Body` type, exported together.
- **Entity ids:** `<prefix>-${uuid()}` generated in the entity (`auth-...`, `profile-...`).
- **DB:** tables and columns are `snake_case` plural tables (`auths`, `profiles`), mapped in
  Prisma with `@map`/`@@map`; Prisma models are singular PascalCase.
- **Routes:** lowercase plural resource (`/profiles`), `me` for "the current user's own".
- **Tests:** `*.spec.ts` (unit, in `test/`), `*.e2e-spec.ts` (in `test/e2e/`).

## Error handling

- Expected failure paths return `fail(<helper>(...))` using `validationError`, `notFoundError`,
  `conflictError`, `unauthorizedError` from `domain/errors.ts`. Success is `ok(value)`.
- Do not `throw` for not found, validation failed, conflict or unauthorized. Throw only for
  genuinely unexpected states, and let `ApiExceptionFilter` turn those into a generic 500.
- Infrastructure translates driver errors into domain-level ones (Prisma `P2002` becomes
  `UniqueViolationError`); services map that to a `conflictError`.
- Never leak internals in auth failures. Return one generic message so callers cannot tell
  which part was wrong.

## Logging

- Use Nest's `Logger` (`new Logger('Name')`) in classes. No `console.log` in `src/` except the
  single "Listening" line in `main.ts`.
- Never log tokens, passwords, hashes, query strings or request bodies.

## Comments

- Comment the **why**: a security reason, a race, a workaround, a non-obvious constraint.
  The existing code does this well (see `auth.service.ts`, `prisma.service.ts`).
- No commented-out code in commits. No TODOs without a reason attached.

## What NOT to do

- No class-validator DTO classes, no `@nestjs/typeorm`, no `process.env` outside `config/env.ts`.
- No new dependency for something solvable in a few lines. Ask first.
- No refactoring or reformatting of code unrelated to the task.
- No business logic in controllers, no HTTP types (`Request`, `Response`) in services.
