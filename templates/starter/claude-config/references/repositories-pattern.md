# Repositories Pattern

Repositories implement the interfaces from `domain/repositories/index.ts` with Prisma. They are
the only place that knows about tables, rows and Prisma errors.

Living examples: `src/infrastructure/repositories/profile.repository.ts` (full pattern with
listing), `auth.repository.ts` (lookups), `login-code.repository.ts` (raw SQL for atomicity),
`unit-of-work.ts`, `database.module.ts`.

## Skeleton

```ts
import { buildPrismaQuery, IParameters, PrismaFieldMap } from 'nestforge';
import type { Prisma } from '../../../generated/prisma';
import { Thing } from '../../domain/thing';
import { IThingRepository, Page } from '../../domain/repositories';
import { DbClient } from '../prisma/prisma.service';

/** Every read excludes soft-deleted rows; Prisma has no built-in soft delete. */
const LIVE = { deletedAt: null } as const;

type ThingRow = NonNullable<Awaited<ReturnType<DbClient['thing']['findFirst']>>>;

/** API field name -> model field and type. Anything not listed is ignored, which keeps filters and sorts injection-safe. */
const FIELDS: PrismaFieldMap = {
	title: { field: 'title', kind: 'string' },
	createdAt: { field: 'createdAt', kind: 'date' },
};

export class ThingRepository implements IThingRepository {
	constructor(private readonly db: DbClient) {}

	async findById(id: string): Promise<Thing | null> {
		const row = await this.db.thing.findFirst({ where: { id, ...LIVE } });
		return row ? toDomain(row) : null;
	}

	async list(parameters: IParameters): Promise<Page<Thing>> {
		const query = buildPrismaQuery(parameters, FIELDS, { defaultSort: [{ field: 'createdAt', direction: 'desc' }] });
		const where = { ...LIVE, ...query.where } as Prisma.ThingWhereInput;

		const [total, rows] = await Promise.all([
			this.db.thing.count({ where }),
			this.db.thing.findMany({
				where,
				orderBy: query.orderBy as Prisma.ThingOrderByWithRelationInput[],
				skip: query.skip,
				take: query.take,
			}),
		]);
		return { items: rows.map(toDomain), total, page: query.page, size: query.size };
	}

	async save(thing: Thing): Promise<void> {
		const data = thing.toPrimitives();
		await this.db.thing.upsert({ where: { id: data.id }, create: data, update: data });
	}

	async softDelete(id: string): Promise<void> {
		await this.db.thing.updateMany({ where: { id, ...LIVE }, data: { deletedAt: new Date() } });
	}
}

function toDomain(row: ThingRow): Thing {
	return Thing.restore({ id: row.id, ownerId: row.ownerId, title: row.title, note: row.note });
}
```

## Rules

1. **Constructor takes `DbClient`** (`Prisma.TransactionClient`), never `PrismaService`. That is
   what lets the same class run against the root client or inside `$transaction`.
2. **Soft delete is manual.** Every read adds `...LIVE`. A new query that forgets it leaks
   deleted rows. `softDelete` uses `updateMany` with `...LIVE` so it is idempotent.
3. **Never `findUnique`** on a field that has a partial unique index (email, provider ids,
   `auth_id`). Use `findFirst` with `...LIVE`. See `database-and-migrations.md`.
4. **Map at the boundary.** `toDomain(row)` goes row to entity via `restore`. Repositories never
   return Prisma rows and never accept Prisma types in their public methods.
5. **Whitelist query fields.** `FIELDS` maps API names to model fields and types; unknown
   filters/sorts are rejected before they reach here. Keep it in step with the controller's
   `@QuerySchema`. `buildPrismaQuery` coerces values to the declared kind and escapes
   `%`/`_` in `contains`.
6. **Normalize lookups the same way the entity does** (`findByEmail` trims and lowercases).
7. **Raw SQL only when atomicity demands it**, with tagged templates (`$queryRaw\`...\``) so
   values are parameterized. Never build SQL with string concatenation, and never use
   `$queryRawUnsafe`/`$executeRawUnsafe` in `src/` (tests may).
8. **No business rules here.** A repository stores and fetches; deciding belongs to the entity
   or service.
9. **Don't catch unique violations here.** The unit of work converts `P2002` into
   `UniqueViolationError`; the service decides what it means.

## Registering a new repository

1. Add the provider and export in `src/infrastructure/database.module.ts`:

   ```ts
   { provide: THING_REPOSITORY, inject: [PrismaService], useFactory: (db: PrismaService) => new ThingRepository(db) },
   ```

   and add `THING_REPOSITORY` to `exports`.
2. If it participates in transactions, add it to `TransactionalRepositories` in the domain and
   to the object built in `PrismaUnitOfWork.run` (`{ auth: new AuthRepository(tx), ... }`).
3. Inject it into a service with `@Inject(THING_REPOSITORY)`.

## Unit of work

Use it when more than one aggregate must be written atomically (register creates an `Auth` and a
`Profile`). The callback receives transaction-bound repositories:

```ts
await this.uow.run(async ({ auth, profile }) => {
	await auth.save(user);
	await profile.save(userProfile);
});
```

Reads outside the callback use the normal injected repositories.
