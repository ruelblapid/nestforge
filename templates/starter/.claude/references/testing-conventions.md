# Testing Conventions

Vitest 3 with `unplugin-swc` (SWC is required so decorator metadata works). Two kinds of test:

| Kind | Location | Command | Needs DB |
| --- | --- | --- | --- |
| Unit | `test/*.spec.ts` | `pnpm test` | no |
| End to end | `test/e2e/*.e2e-spec.ts` | `pnpm test:e2e` | yes |

Both configs: `vitest.config.ts`, `vitest.e2e.config.ts` (serial files, longer timeouts).
Write tests alongside the change, not afterward. `.claude/scripts/run_tests.sh` runs the
architecture check, typecheck and unit tests (`RUN_E2E=1` adds e2e).

## Unit tests: services and adapters

Construct the class directly with **in-memory fakes** of the repository interfaces. No Nest
testing module, no Prisma. Model after `test/auth.service.spec.ts`.

```ts
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Must run before any import that loads src/config/env.ts.
vi.hoisted(() => {
	process.env.DATABASE_URL = 'postgres://x';
	process.env.JWT_SECRET = 'a'.repeat(32);
	process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
});

import { ThingService } from '../src/application/thing.service';
import { IThingRepository } from '../src/domain/repositories';
import { Thing } from '../src/domain/thing';

class FakeThingRepo implements Partial<IThingRepository> {
	rows = new Map<string, Thing>();
	async findById(id: string) { return this.rows.get(id) ?? null; }
	async save(t: Thing) { this.rows.set(t.id, t); }
}

describe('ThingService', () => {
	let repo: FakeThingRepo;
	let service: ThingService;
	beforeEach(() => {
		repo = new FakeThingRepo();
		service = new ThingService(repo as unknown as IThingRepository);
	});

	it('returns 404 for an unknown id', async () => {
		const result = await service.get('nope');
		expect(result.getLeft()).toMatchObject({ code: 404 });
	});
});
```

- Assert on the `Result`: `result.isRight()`, `result.getLeft()` with `toMatchObject({ code: 409 })`.
- Fake a unit of work by snapshotting and restoring the fakes' maps on throw (see the
  `uow` in `auth.service.spec.ts`) so rollback behavior is testable without a database.
- Fake external ports (`IIdentityVerifier`, `IOAuthClient`) the same way. Never hit the network.
- Domain entities need no fakes: test `create`/`update` validation directly.
- Test the unhappy paths that matter: not found, validation failure, conflict, wrong
  credentials, replay of a single-use token.

## E2E tests: the real HTTP stack

Model after `test/e2e/app.e2e-spec.ts`. They boot `AppModule` against real Postgres.

Prerequisites: `docker compose up -d --wait` and `pnpm db:migrate`. **They TRUNCATE tables**, so
never point them at a database you care about.

Shape to keep:

- Set env in `vi.hoisted` (`NODE_ENV='test'`, `DATABASE_URL ??= ...local compose...`, 32-char
  secrets, `METRICS_TOKEN`).
- Build the app with `Test.createTestingModule({ imports: [AppModule] })`, override
  `ThrottlerStorage` with an always-allow stub (otherwise rate limits trip), apply the same global
  prefix and exclusions as `main.ts`, `app.useLogger(false)`.
- `beforeEach`: `TRUNCATE TABLE login_codes, profiles, auths CASCADE` and **add every new table
  to this list**.
- Helpers (`register()`, `login()`, `bearer(token)`, `makeAdmin(email)`) keep tests short.
- Use `supertest` (`request(app.getHttpServer())`).
- Cover: success, 400 on invalid body (violations listed), 401 without a token, 403 on the wrong
  role, 404, 409.
- Database behavior belongs here, not in unit tests: soft delete invisibility, partial-unique
  reuse of a deleted row's value, concurrent writes producing exactly one winner, transaction
  rollback, filter/sort/paging results.

## Rules

- No sleeps for timing; control the clock or the TTL instead.
- Tests do not depend on order or on data left by other tests.
- Don't weaken or delete a failing test to get green. Fix the code or tell the user the
  expectation has changed.
- Don't snapshot secrets or tokens in assertions beyond shape.
