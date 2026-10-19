---
name: security-check
description: Use this skill to run a security review of this NestJS API or of a specific change. Trigger on requests like "security check", "security review", "audit this endpoint", "is this safe", "check auth on this route", or before shipping anything that touches authentication, roles, public routes, raw SQL, environment variables, file or user input handling, or deployment config. Runs .claude/scripts/security_scan.sh to collect facts, then reviews them against the project's security rules and reports findings by severity. Reports only; does not change code unless asked.
---

# Security Check

A review of THIS API's real attack surface, grounded in `.claude/references/auth-pattern.md`.
Collect facts with the script first, then read the code the facts point to. Report only what you
verified.

## 1. Collect facts

```sh
bash .claude/scripts/security_scan.sh
```

It prints, from the current code: every route with its protection (`@Public()`, `@Roles`,
`@Throttle`), raw SQL, hard-coded secret patterns, whether `.env` is tracked by git, missing
HTTP hardening (helmet, CORS), the production defaults for Swagger and metrics, and a
`pnpm audit --prod` summary. It exits non-zero only for hard failures (a tracked `.env`, a
hard-coded secret, unsafe raw SQL). Everything else is information for you to judge.

If the script cannot run something (no git, no network for audit), say so in the report instead of
skipping it silently.

## 2. Scope

If the user named a change, route or feature, review that first (use `git diff`), then the
inventory for anything it affects. Otherwise review the whole API surface.

## 3. Checklist

Read the code behind each item. Mark it pass, fail or not applicable.

**Authentication and sessions**
- Every route is protected by default. Each `@Public()` is justified: register, login, refresh,
  provider sign-in, OAuth redirect/callback/exchange, health, metrics. Anything else public is a
  finding.
- Guard order is still throttle, authenticate, authorize in `AppModule`.
- Access and refresh tokens use separate secrets (32+ chars); refresh tokens are stored as SHA-256,
  rotate on use, and are cleared on logout and password change.
- Login does not reveal whether an email exists (generic message, dummy-hash compare).
- No token, password, hash, login code or provider token is logged or returned.

**Authorization (IDOR / privilege)**
- Self-service routes take the user id from `@CurrentUser()`, never from the body or path.
- Any route taking a resource id checks the caller owns it or has the role. Missing ownership
  checks on `:id` routes are the most likely serious bug in new code.
- `@Roles(Role.ADMIN)` on admin-only routes; roles are never accepted from request input.

**Input handling**
- Every `@Body()`/`@Query()` is validated by a `z.strictObject` schema with length and range
  bounds (mass assignment and unbounded input are rejected).
- List endpoints expose only whitelisted filter/sort fields through `@QuerySchema` and the
  repository `FIELDS` map.
- No string-built SQL. Raw SQL uses tagged templates (`$queryRaw`, `$executeRaw`).
- Redirect targets come from config, never from the request (no open redirect).

**Data exposure**
- Responses are explicit views; no password hashes, refresh hashes or internal fields.
- Soft-deleted rows are excluded from every read (`LIVE`), including new raw queries.
- Error responses do not leak stack traces, SQL or provider details (unexpected errors are a
  generic 500).

**Abuse resistance**
- Credential and code-exchange routes keep `@Throttle` limits.
- Public endpoints that do expensive work are rate limited.

**Configuration and deployment**
- Secrets only in env, never in source or `.env.example` beyond placeholders; `.env` is ignored.
- Production defaults are safe: Swagger off unless `SWAGGER_ENABLED=true`, DB TLS on,
  `METRICS_TOKEN` set or `/metrics` restricted at the network level.
- Docker runtime runs as the unprivileged `node` user and does not contain the Prisma CLI or
  secrets.
- Migrations run as a separate step; the API never alters the schema.

**HTTP hardening (decisions for the owner)**
- `helmet` and explicit CORS are not configured in `main.ts` by default. Report this as an
  informational finding with the tradeoff. Adding a dependency or enabling CORS needs the
  user's decision; do not add it unasked.

**Dependencies**
- `pnpm audit --prod` high or critical issues, with the affected package and whether a fix
  version exists. Do not bump packages unasked.

## 4. Report

```markdown
## Security check: <scope>

**Summary:** one or two sentences, and the highest severity found.
**Script:** security_scan.sh <passed/failed>, audit <summary or not run>

### Critical / High
1. `path/file.ts:42` What the weakness is, how it could be exploited in this app, the fix.

### Medium
1. ...

### Low / informational
1. ...

### Verified OK
- Short list of the areas checked and found fine (only what you actually checked).
```

Rules:
- Severity reflects real exploitability in this app, not theoretical risk. Explain the attack in
  one sentence.
- Every finding has `file:line`, impact, and a concrete fix.
- Never print secrets you find; point to the file and line and say it must be rotated.
- A finding in a `@Public()` route or in auth code outranks the same finding elsewhere.
- Do not change code during the check. Offer to apply the fixes afterward, and add a test for
  each fixed vulnerability.
