import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { buildPrismaQuery, escapeLike, PrismaFieldMap, PrismaQueryOptions, QueryParametersPipe } from '../src';

const fields: PrismaFieldMap = {
	name: { field: 'name', kind: 'string' },
	age: { field: 'age', kind: 'number' },
	createdAt: { field: 'createdAt', kind: 'date' },
	active: { field: 'active', kind: 'boolean' },
	state: { field: 'state', kind: 'string' },
	providerName: { field: 'provider.name', kind: 'string' },
};

const build = (query: Record<string, unknown>, options?: PrismaQueryOptions) =>
	buildPrismaQuery(new QueryParametersPipe().transform(query as never), fields, options);

describe('buildPrismaQuery filters', () => {
	it('is empty without filters', () => {
		expect(build({}).where).toEqual({ AND: [] });
	});

	it('maps comparison operators and converts the string to the field type', () => {
		const { where } = build({ 'filter[age][gte]': '30', 'filter[name][equals]': 'Ann' });
		expect(where.AND).toEqual(expect.arrayContaining([{ age: { gte: 30 } }, { name: 'Ann' }]));
	});

	it.each([
		['gt', { gt: 5 }],
		['lt', { lt: 5 }],
		['lte', { lte: 5 }],
		['not_eq', { not: 5 }],
	])('maps %s', (op, expected) => {
		expect(build({ [`filter[age][${op}]`]: '5' }).where.AND).toEqual([{ age: expected }]);
	});

	it('drops a value that does not fit the field type instead of failing', () => {
		expect(build({ 'filter[age][gte]': 'abc' }).where.AND).toEqual([]);
		expect(build({ 'filter[age][gte]': '' }).where.AND).toEqual([]);
		expect(build({ 'filter[createdAt][gte]': 'not-a-date' }).where.AND).toEqual([]);
		expect(build({ 'filter[active][equals]': 'maybe' }).where.AND).toEqual([]);
	});

	it('parses dates and booleans', () => {
		const { where } = build({ 'filter[createdAt][gte]': '2026-01-02', 'filter[active][equals]': 'true' });
		expect(where.AND).toEqual(expect.arrayContaining([{ createdAt: { gte: new Date('2026-01-02') } }, { active: true }]));
	});

	it('contains is case-insensitive and matches % and _ literally', () => {
		expect(build({ 'filter[name][contains]': '50%_off' }).where.AND).toEqual([
			{ name: { contains: '50\\%\\_off', mode: 'insensitive' } },
		]);
		expect(build({ 'filter[name][not_contains]': 'x' }).where.AND).toEqual([
			{ NOT: { name: { contains: 'x', mode: 'insensitive' } } },
		]);
	});

	it('ignores contains on a non-string field', () => {
		expect(build({ 'filter[age][contains]': '5' }).where.AND).toEqual([]);
	});

	it('supports between, in and not_in', () => {
		expect(build({ 'filter[age][between]': '10,20' }).where.AND).toEqual([{ age: { gte: 10, lte: 20 } }]);
		expect(build({ 'filter[state][in]': 'CA,NY' }).where.AND).toEqual([{ state: { in: ['CA', 'NY'] } }]);
		expect(build({ 'filter[age][in]': '1,x,3' }).where.AND).toEqual([{ age: { in: [1, 3] } }]);
		expect(build({ 'filter[state][not_in]': 'CA,NY' }).where.AND).toEqual([{ state: { notIn: ['CA', 'NY'] } }]);
		expect(build({ 'filter[state][in]': 'CA' }).where.AND).toEqual([{ state: { in: ['CA'] } }]);
	});

	it('ignores fields that are not in the map', () => {
		expect(build({ 'filter[password][equals]': 'x' }).where.AND).toEqual([]);
	});

	it('reaches through relations with a dotted path', () => {
		expect(build({ 'filter[providerName][equals]': 'Dr' }).where.AND).toEqual([{ provider: { name: 'Dr' } }]);
	});
});

describe('buildPrismaQuery sort', () => {
	it('sorts by the requested fields, ascending or descending, then by id for stable pages', () => {
		expect(build({ sort: '-age,name' }).orderBy).toEqual([{ age: 'desc' }, { name: 'asc' }, { id: 'asc' }]);
	});

	it('skips unknown sort fields and falls back to the default sort', () => {
		const q = build({ sort: 'password' }, { defaultSort: [{ field: 'createdAt', direction: 'desc' }] });
		expect(q.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'asc' }]);
	});

	it('sorts through relations and supports a custom or disabled tie-breaker', () => {
		expect(build({ sort: 'providerName' }, { tieBreaker: 'uuid' }).orderBy).toEqual([{ provider: { name: 'asc' } }, { uuid: 'asc' }]);
		expect(build({ sort: 'age' }, { tieBreaker: null }).orderBy).toEqual([{ age: 'asc' }]);
	});
});

describe('buildPrismaQuery paging', () => {
	it('defaults to page 1 of 50', () => {
		expect(build({})).toMatchObject({ page: 1, size: 50, skip: 0, take: 50 });
	});

	it('computes skip and take', () => {
		expect(build({ 'page[number]': '3', 'page[size]': '20' })).toMatchObject({ page: 3, size: 20, skip: 40, take: 20 });
	});

	it('caps the page size and never goes below 1', () => {
		expect(build({ 'page[size]': '5000' }).take).toBe(100);
		expect(build({ 'page[size]': '5000' }, { maxPageSize: 500 }).take).toBe(500);
		expect(build({ 'page[number]': '0', 'page[size]': '0' })).toMatchObject({ page: 1, size: 1, skip: 0 });
		expect(build({ 'page[number]': 'abc' }).page).toBe(1);
	});
});

describe('escapeLike', () => {
	it('escapes wildcards and the escape character', () => {
		expect(escapeLike('100%_\\')).toBe('100\\%\\_\\\\');
	});
});
