import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
	FilterValueType,
	Operator,
	QueryParametersPipe,
	QueryParser,
	QuerySchema,
	QueryValidationException,
	validateQuery,
} from '../src';
import SortParameter from '../src/Query/Parameters/SortParameter';

class DemoController {
	@QuerySchema({
		filters: {
			name: { type: FilterValueType.STRING, operators: [Operator.EQUALS, Operator.CONTAINS] },
			age: { type: FilterValueType.NUMBER, operators: [Operator.GTE] },
		},
		sort: ['name', 'age'],
		pagination: true,
	})
	list() {}
}

const check = (q: Record<string, any>) => validateQuery(DemoController, 'list', QueryParser.parse(q));

describe('validateQuery', () => {
	it('accepts a valid query', () => {
		expect(() =>
			check({ 'filter[name][contains]': 'bo', 'filter[age][gte]': '3', sort: '-name', 'page[number]': '1', 'page[size]': '10' }),
		).not.toThrow();
	});

	it.each([
		['unknown filter field', { 'filter[password][contains]': 'x' }],
		['disallowed operator', { 'filter[name][gte]': 'x' }],
		['non-numeric value', { 'filter[age][gte]': 'abc' }],
		['unknown sort field', { sort: 'password' }],
		['bad page size', { 'page[size]': '0' }],
	])('rejects %s', (_label, query) => {
		expect(() => check(query)).toThrow(QueryValidationException);
	});

	it('does nothing for handlers without a schema', () => {
		expect(() => validateQuery(DemoController, 'other', QueryParser.parse({ anything: '1' }))).not.toThrow();
	});
});

describe('SortParameter.toQueryString', () => {
	it('marks only descending sorts with a minus', () => {
		expect(new SortParameter('name', true).toQueryString()).toBe('name');
		expect(new SortParameter('name', false).toQueryString()).toBe('-name');
	});
});

describe('operator names', () => {
	it.each([
		['not_contains', 'ILIKE'],
		['contains', 'ILIKE'],
		['not_eq', '!='],
		['equals', '='],
		['eq', '='],
		['in', 'IN'],
		['not_in', 'NOT IN'],
		['between', 'BETWEEN'],
	])('maps %s', (name) => {
		const f = new QueryParametersPipe().transform({ [`filter[x][${name}]`]: 'a,b' }).getFilterParameters().getFilters()[0];
		expect(f.operator.value).toBeDefined();
	});

	it('maps not_contains to NOT ILIKE, not to equality', () => {
		const f = new QueryParametersPipe().transform({ 'filter[x][not_contains]': 'a' }).getFilterParameters().getFilters()[0];
		expect(f.operator.value).toBe('NOT ILIKE');
	});

	it('rejects an unknown operator instead of turning it into equality', () => {
		expect(() => QueryParser.parse({ 'filter[x][containz]': 'a' })).toThrow(QueryValidationException);
		expect(() => new QueryParametersPipe().transform({ 'filter[x][containz]': 'a' })).toThrow(BadRequestException);
	});

	it('lists the offending field in the error', () => {
		try {
			QueryParser.parse({ 'filter[name][startswith]': 'a' });
			expect.unreachable();
		} catch (e) {
			expect((e as QueryValidationException).details[0]).toMatchObject({ field: 'filter[name]' });
		}
	});
});
