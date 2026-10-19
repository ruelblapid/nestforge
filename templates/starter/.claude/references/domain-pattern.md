# Domain Pattern

The domain layer is plain TypeScript. It imports `uuid` and types/values from `nestforge`
(`Either`, `DataError`, `IParameters`), nothing from Nest, Prisma or the environment.

Living examples: `src/domain/profile.ts`, `src/domain/auth-user.ts`, `src/domain/errors.ts`,
`src/domain/role.ts`, `src/domain/repositories/index.ts`.

## Result and error helpers (`domain/errors.ts`)

```ts
export type Result<T> = Either<DataError, T>;
export const ok = <T>(value: T): Result<T> => Either.right<DataError, T>(value);
export const fail = <T = never>(error: DataError): Result<T> => Either.left<DataError, T>(error);
```

| Helper | HTTP code | Use for |
| --- | --- | --- |
| `validationError(message)` | 400 | invalid input or a violated business rule |
| `unauthorizedError(message = 'Invalid credentials')` | 401 | bad credentials or token |
| `notFoundError(message)` | 404 | the thing does not exist (or is soft-deleted) |
| `conflictError(message)` | 409 | duplicate / state conflict |

`DataError.code` is the HTTP status that `EitherInterceptor` uses. For a stable machine-readable
error code (so clients can branch on it), `nestforge` provides
`codedError('CLAIM_NOT_FOUND', 'Claim not found', 404, { claimId })`. Use it when a client needs
to distinguish cases; otherwise the helpers above are enough. Add new helpers to `errors.ts`;
do not build `DataError` literals elsewhere.

## Entity shape

```ts
import { v4 as uuid } from 'uuid';
import { fail, ok, Result, validationError } from './errors';

export interface ThingProps {
	id: string;
	ownerId: string;
	title: string;
	note: string | null;
}

type ThingFields = { title?: string; note?: string };

export class Thing {
	private constructor(private props: ThingProps) {}

	/** New entity: validates and normalizes. */
	static create(input: ThingFields & { ownerId: string; title: string }): Result<Thing> {
		const invalid = Thing.validate(input);
		if (invalid) return fail(validationError(invalid));
		return ok(
			new Thing({
				id: `thing-${uuid()}`,
				ownerId: input.ownerId,
				title: input.title.trim(),
				note: input.note?.trim() ?? null,
			}),
		);
	}

	/** Rehydrates from persistence. No validation: the database is trusted. */
	static restore(props: ThingProps): Thing {
		return new Thing(props);
	}

	update(changes: ThingFields): Result<Thing> {
		const invalid = Thing.validate(changes);
		if (invalid) return fail(validationError(invalid));
		if (changes.title !== undefined) this.props.title = changes.title.trim();
		if (changes.note !== undefined) this.props.note = changes.note.trim();
		return ok(this);
	}

	private static validate(v: ThingFields): string | null {
		if (v.title !== undefined && v.title.trim().length < 2) return 'Title must be at least 2 characters long';
		return null;
	}

	get id() {
		return this.props.id;
	}
	get ownerId() {
		return this.props.ownerId;
	}

	toPrimitives(): ThingProps {
		return { ...this.props };
	}
}
```

Rules:

- **Private constructor.** Two entry points only: `create` (validate) and `restore` (trust).
- **Props stay private.** Expose read-only getters for what callers need and `toPrimitives()`
  (a copy) for persistence and views.
- **Normalize in the entity** (trim, lowercase emails). Repositories and services do not.
- **Behavior lives on the entity**: `recordLogin`, `rotateRefreshToken`, `changePasswordHash`.
  A service calls a verb; it does not poke fields.
- **Ids** are generated in `create` with a readable prefix.
- **Passwords arrive already hashed.** The domain never imports `bcrypt`.
- Enums go in their own file (`role.ts`) as string enums.
- Keys in `ThingProps` must match the Prisma model's field names, because the repository
  upserts `toPrimitives()` directly.

## Repository interfaces (`domain/repositories/index.ts`)

Every repository gets a Symbol token, an interface and, when it lists, uses the shared `Page<T>`:

```ts
export const THING_REPOSITORY = Symbol('THING_REPOSITORY');

export interface IThingRepository {
	findById(id: string): Promise<Thing | null>;
	list(parameters: IParameters): Promise<Page<Thing>>;
	/** Inserts or updates. */
	save(thing: Thing): Promise<void>;
	softDelete(id: string): Promise<void>;
}
```

Conventions:

- Methods return entities or `null`, never Prisma rows and never `Either`.
- `save` is insert-or-update (upsert) and takes the entity.
- `softDelete(id)` instead of `delete`, for any table with `deleted_at`.
- If writes across repositories must be atomic, add the repository to `TransactionalRepositories`
  and use `IUnitOfWork.run(...)` from a service. The unit of work throws `UniqueViolationError`
  when a unique constraint loses a race.
- Document non-obvious contracts on the interface (see `ILoginCodeRepository.consume`).
