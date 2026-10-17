import { IParameters } from 'nestforge';
import type { Prisma } from '../../../generated/prisma';
import { Profile } from '../../domain/profile';
import { IProfileRepository, Page } from '../../domain/repositories';
import { DbClient } from '../prisma/prisma.service';

/** Every read excludes soft-deleted rows; Prisma has no built-in soft delete. */
const LIVE = { deletedAt: null } as const;

type ProfileRow = NonNullable<Awaited<ReturnType<DbClient['profile']['findFirst']>>>;
type Field = 'name' | 'lastname' | 'age' | 'createdAt';
type Kind = 'string' | 'number' | 'date';

/**
 * API field name -> model field and its type. Anything not listed is ignored, which keeps filters and sorts
 * injection-safe. The type matters: query values arrive as strings, and Prisma (unlike a bare SQL cast) rejects
 * a string where an Int or DateTime is expected.
 */
const FILTERABLE: Record<string, { field: Field; kind: Kind }> = {
	name: { field: 'name', kind: 'string' },
	lastname: { field: 'lastname', kind: 'string' },
	age: { field: 'age', kind: 'number' },
	createdAt: { field: 'createdAt', kind: 'date' },
};
const MAX_PAGE_SIZE = 100;

export class ProfileRepository implements IProfileRepository {
	constructor(private readonly db: DbClient) {}

	async findById(id: string): Promise<Profile | null> {
		const row = await this.db.profile.findFirst({ where: { id, ...LIVE } });
		return row ? toDomain(row) : null;
	}

	async findByAuthId(authId: string): Promise<Profile | null> {
		const row = await this.db.profile.findFirst({ where: { authId, ...LIVE } });
		return row ? toDomain(row) : null;
	}

	async list(parameters: IParameters): Promise<Page<Profile>> {
		const where: Prisma.ProfileWhereInput = { ...LIVE, AND: buildFilters(parameters) };

		const paging = parameters.getPagingParameters();
		const page = Math.max(1, Number(paging?.getPage() ?? 1));
		const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(paging?.getSize() ?? 50)));

		const [total, rows] = await Promise.all([
			this.db.profile.count({ where }),
			this.db.profile.findMany({ where, orderBy: buildSort(parameters), skip: (page - 1) * size, take: size }),
		]);
		return { items: rows.map(toDomain), total, page, size };
	}

	async save(profile: Profile): Promise<void> {
		const data = profile.toPrimitives();
		await this.db.profile.upsert({ where: { id: data.id }, create: data, update: data });
	}

	async softDelete(id: string): Promise<void> {
		await this.db.profile.updateMany({ where: { id, ...LIVE }, data: { deletedAt: new Date() } });
	}
}

function buildFilters(parameters: IParameters): Prisma.ProfileWhereInput[] {
	if (!parameters.hasFilters()) return [];
	const conditions: Prisma.ProfileWhereInput[] = [];

	for (const filter of parameters.getFilterParameters().getFilters()) {
		const target = FILTERABLE[filter.field.value];
		if (!target) continue;
		const { field, kind } = target;
		const op = filter.operator.value as string; // validated against the Operator enum
		const scalar = (v: unknown) => coerce(kind, v);
		const value = filter.value.value;

		switch (op) {
			case '=':
			case '!=':
			case '>':
			case '>=':
			case '<':
			case '<=': {
				const v = scalar(value);
				if (v === undefined) continue;
				conditions.push({ [field]: comparison(op, v) });
				break;
			}
			case 'BETWEEN': {
				if (!Array.isArray(value) || value.length !== 2) continue;
				const [lo, hi] = [scalar(value[0]), scalar(value[1])];
				if (lo === undefined || hi === undefined) continue;
				conditions.push({ [field]: { gte: lo, lte: hi } });
				break;
			}
			case 'ILIKE':
			case 'NOT ILIKE': {
				// Prisma passes `contains` to LIKE unescaped, so % and _ in user input would act as wildcards.
				if (kind !== 'string') continue;
				const match = { [field]: { contains: escapeLike(String(value)), mode: 'insensitive' as const } };
				conditions.push(op === 'ILIKE' ? match : { NOT: match });
				break;
			}
		}
	}
	return conditions;
}

/** Escapes LIKE wildcards (and the escape character itself) so the text is matched literally. */
function escapeLike(text: string): string {
	return text.replace(/[\\%_]/g, '\\$&');
}

function comparison(op: string, v: unknown) {
	switch (op) {
		case '=': return v;
		case '!=': return { not: v };
		case '>': return { gt: v };
		case '>=': return { gte: v };
		case '<': return { lt: v };
		default: return { lte: v };
	}
}

/** Values that do not fit the field's type become undefined and the condition is dropped, instead of a 500. */
function coerce(kind: Kind, v: unknown): string | number | Date | undefined {
	if (kind === 'number') {
		const n = typeof v === 'number' ? v : Number(v);
		return Number.isFinite(n) ? n : undefined;
	}
	if (kind === 'date') {
		const d = v instanceof Date ? v : new Date(String(v));
		return Number.isNaN(d.getTime()) ? undefined : d;
	}
	return String(v);
}

function buildSort(parameters: IParameters): Prisma.ProfileOrderByWithRelationInput[] {
	const order: Prisma.ProfileOrderByWithRelationInput[] = [];
	for (const sort of parameters.hasSort() ? parameters.getSortParameters() : []) {
		const target = FILTERABLE[sort.getField()];
		if (target) order.push({ [target.field]: sort.isAscending() ? 'asc' : 'desc' });
	}
	if (order.length === 0) order.push({ createdAt: 'desc' });
	// Tie-break so pages are stable when the sort key repeats.
	order.push({ id: 'asc' });
	return order;
}

function toDomain(row: ProfileRow): Profile {
	return Profile.restore({
		id: row.id,
		authId: row.authId,
		name: row.name,
		lastname: row.lastname,
		age: row.age,
	});
}
