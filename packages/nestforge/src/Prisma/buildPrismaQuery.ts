import type { IParameters } from '../Query/Parameters';

/** How an API value is converted before it reaches the database. Query values arrive as strings. */
export type PrismaFieldKind = 'string' | 'number' | 'date' | 'boolean';

export interface PrismaFieldMap {
	/**
	 * API field name -> model field and type. `field` may be a dotted path through relations
	 * (`provider.name` becomes `{ provider: { name: ... } }`). Anything not listed is ignored,
	 * which keeps filters and sorts injection-safe.
	 */
	[apiField: string]: { field: string; kind: PrismaFieldKind };
}

export interface PrismaQueryOptions {
	/** Applied when the request names no (usable) sort. API field names. Default: none. */
	defaultSort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
	/** Model field appended to the sort so pages are stable when the sort key repeats. Default `id`; `null` disables. */
	tieBreaker?: string | null;
	defaultPageSize?: number;
	maxPageSize?: number;
}

type Obj = Record<string, unknown>;

export interface PrismaQuery {
	/** Spread into `where` next to your own constraints: `{ deletedAt: null, ...query.where }`. */
	where: { AND: Obj[] };
	orderBy: Obj[];
	skip: number;
	take: number;
	page: number;
	size: number;
}

/**
 * Turns a parsed query (`filter[...]`, `sort`, `page[...]`) into arguments for `findMany` / `count`.
 * Pure: builds plain objects, so nestforge needs no Prisma dependency.
 *
 *   const q = buildPrismaQuery(parameters, { name: { field: 'name', kind: 'string' } });
 *   const [total, items] = await Promise.all([
 *     db.profile.count({ where: { deletedAt: null, ...q.where } }),
 *     db.profile.findMany({ where: { deletedAt: null, ...q.where }, orderBy: q.orderBy, skip: q.skip, take: q.take }),
 *   ]);
 *
 * Filters whose value does not fit the field's type are dropped rather than failing the request.
 */
export function buildPrismaQuery(parameters: IParameters, fields: PrismaFieldMap, options: PrismaQueryOptions = {}): PrismaQuery {
	const maxPageSize = options.maxPageSize ?? 100;
	const paging = parameters.getPagingParameters();
	const page = Math.max(1, Math.trunc(Number(paging?.getPage() ?? 1)) || 1);
	const size = Math.min(maxPageSize, Math.max(1, Math.trunc(Number(paging?.getSize() ?? options.defaultPageSize ?? 50)) || 1));

	return {
		where: { AND: buildFilters(parameters, fields) },
		orderBy: buildSort(parameters, fields, options),
		skip: (page - 1) * size,
		take: size,
		page,
		size,
	};
}

function buildFilters(parameters: IParameters, fields: PrismaFieldMap): Obj[] {
	if (!parameters.hasFilters()) return [];
	const conditions: Obj[] = [];

	for (const filter of parameters.getFilterParameters().getFilters()) {
		const target = fields[filter.field.value];
		if (!target) continue;
		const { field, kind } = target;
		const op = filter.operator.value as string;
		const raw = filter.value.value;
		const one = (v: unknown) => coerce(kind, v);

		switch (op) {
			case '=':
			case '!=':
			case '>':
			case '>=':
			case '<':
			case '<=': {
				const v = one(raw);
				if (v === undefined) continue;
				conditions.push(nest(field, comparison(op, v)));
				break;
			}
			case 'BETWEEN': {
				if (!Array.isArray(raw) || raw.length !== 2) continue;
				const [lo, hi] = [one(raw[0]), one(raw[1])];
				if (lo === undefined || hi === undefined) continue;
				conditions.push(nest(field, { gte: lo, lte: hi }));
				break;
			}
			case 'IN':
			case 'NOT IN': {
				const list = (Array.isArray(raw) ? raw : String(raw).split(',')).map(one).filter((v) => v !== undefined);
				if (list.length === 0) continue;
				conditions.push(nest(field, op === 'IN' ? { in: list } : { notIn: list }));
				break;
			}
			case 'ILIKE':
			case 'NOT ILIKE': {
				// Prisma passes `contains` to LIKE unescaped, so % and _ in user input would act as wildcards.
				if (kind !== 'string') continue;
				const match = nest(field, { contains: escapeLike(String(raw)), mode: 'insensitive' });
				conditions.push(op === 'ILIKE' ? match : { NOT: match });
				break;
			}
		}
	}
	return conditions;
}

function buildSort(parameters: IParameters, fields: PrismaFieldMap, options: PrismaQueryOptions): Obj[] {
	const order: Obj[] = [];
	for (const sort of parameters.hasSort() ? parameters.getSortParameters() : []) {
		const target = fields[sort.getField()];
		if (target) order.push(nest(target.field, sort.isAscending() ? 'asc' : 'desc'));
	}
	if (order.length === 0) {
		for (const d of options.defaultSort ?? []) {
			const target = fields[d.field];
			if (target) order.push(nest(target.field, d.direction));
		}
	}
	const tieBreaker = options.tieBreaker === undefined ? 'id' : options.tieBreaker;
	if (tieBreaker) order.push(nest(tieBreaker, 'asc'));
	return order;
}

/** `nest('a.b', x)` -> `{ a: { b: x } }`. */
function nest(path: string, value: unknown): Obj {
	return path
		.split('.')
		.reverse()
		.reduce<unknown>((inner, key) => ({ [key]: inner }), value) as Obj;
}

function comparison(op: string, v: unknown): unknown {
	switch (op) {
		case '=': return v;
		case '!=': return { not: v };
		case '>': return { gt: v };
		case '>=': return { gte: v };
		case '<': return { lt: v };
		default: return { lte: v };
	}
}

/** Escapes LIKE wildcards (and the escape character itself) so the text is matched literally. */
export function escapeLike(text: string): string {
	return text.replace(/[\\%_]/g, '\\$&');
}

/** Values that do not fit the field's type become undefined and the condition is dropped, instead of a 500. */
function coerce(kind: PrismaFieldKind, v: unknown): string | number | boolean | Date | undefined {
	switch (kind) {
		case 'number': {
			const n = typeof v === 'number' ? v : Number(v);
			return typeof v === 'string' && v.trim() === '' ? undefined : Number.isFinite(n) ? n : undefined;
		}
		case 'date': {
			const d = v instanceof Date ? v : new Date(String(v));
			return Number.isNaN(d.getTime()) ? undefined : d;
		}
		case 'boolean': {
			if (typeof v === 'boolean') return v;
			const s = String(v).toLowerCase();
			return s === 'true' ? true : s === 'false' ? false : undefined;
		}
		default:
			return String(v);
	}
}
