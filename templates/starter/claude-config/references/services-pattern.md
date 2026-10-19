# Services Pattern

Services in `src/application/` are the use cases. They load entities through repository
interfaces, call entity behavior, persist, and return a `Result`.

Living examples: `src/application/profile.service.ts` (small, the template to copy),
`auth.service.ts` (transactions, security details), `oauth.service.ts` (external flows).

## Skeleton

```ts
import { Inject, Injectable } from '@nestjs/common';
import { IParameters } from 'nestforge';
import { fail, notFoundError, ok, Result } from '../domain/errors';
import { IThingRepository, Page, THING_REPOSITORY } from '../domain/repositories';
import { Thing, ThingProps } from '../domain/thing';

export type ThingView = ThingProps;

@Injectable()
export class ThingService {
	constructor(@Inject(THING_REPOSITORY) private readonly things: IThingRepository) {}

	async get(id: string): Promise<Result<ThingView>> {
		const thing = await this.things.findById(id);
		return thing ? ok(thing.toPrimitives()) : fail(notFoundError('Thing not found'));
	}

	async update(id: string, changes: { title?: string; note?: string }): Promise<Result<ThingView>> {
		const thing = await this.things.findById(id);
		if (!thing) return fail(notFoundError('Thing not found'));

		const updated = thing.update(changes);
		if (updated.isLeft()) return fail(updated.getLeft());

		await this.things.save(thing);
		return ok(thing.toPrimitives());
	}

	async list(parameters: IParameters): Promise<Result<Page<ThingView>>> {
		const page = await this.things.list(parameters);
		return ok({ ...page, items: page.items.map((t: Thing) => t.toPrimitives()) });
	}
}
```

## Rules

1. **Return `Promise<Result<T>>`**, always. Unwrap with `isLeft()` / `getLeft()` /
   `getRight()` and propagate a `Left` with `fail(x.getLeft())`.
2. **Return views, not entities.** `toPrimitives()` copies. Never return something that carries a
   password hash, refresh token hash or other secret; build an explicit view type instead.
3. **Inject interfaces by token** (`@Inject(THING_REPOSITORY)`). Never import from
   `infrastructure/`.
4. **No HTTP in services.** No `Request`/`Response`, no Nest exceptions, no status codes beyond
   the `DataError` helpers. If a flow needs a cookie or redirect, return the data and let the
   controller apply it (see `OAuthService.start` returning `StartRedirect`).
5. **Ownership comes from the caller.** Methods that act on "my" data take the authenticated
   `userId` as an argument (`getMine(authId)`), supplied by the controller from the token. Never
   trust an owner id from a request body.
6. **Atomic multi-aggregate writes use `IUnitOfWork`.** Do the pre-check inside the callback and
   also catch `UniqueViolationError` outside it, because two concurrent requests can both pass the
   check (see `AuthService.createAccount`).
7. **Ports for the outside world.** A third-party call is an interface + Symbol token in
   `application/` (`IIdentityVerifier`, `IOAuthClient`), implemented in `infrastructure/`,
   and faked in unit tests.
8. **Env access is allowed** here via `import { env } from '../config/env'`, but only for config
   a use case genuinely needs (token TTLs, secrets).
9. **Security-sensitive code stays boring and explicit**: constant-time compares
   (`timingSafeEqual`), a dummy bcrypt hash for unknown users, SHA-256 for token storage,
   generic failure messages. Do not simplify these. See `auth-pattern.md`.
10. **Register the service** as a provider in `app.module.ts`.

## Unit-testing a service

Construct it directly with in-memory fakes, no Nest testing module, no database. See
`testing-conventions.md`.
