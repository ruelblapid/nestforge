import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { BadRequestException } from '@nestjs/common';
import { QueryParametersPipe, ZodValidationPipe } from '../src';

describe('ZodValidationPipe', () => {
	const pipe = new ZodValidationPipe(z.object({ email: z.email() }));

	it('returns parsed data', () => {
		expect(pipe.transform({ email: 'a@b.com' })).toEqual({ email: 'a@b.com' });
	});

	it('throws BadRequestException with field errors', () => {
		expect(() => pipe.transform({ email: 'nope' })).toThrow(BadRequestException);
	});
});

describe('QueryParametersPipe', () => {
	it('parses filter, sort and page', () => {
		const params = new QueryParametersPipe().transform({
			'filter[name][contains]': 'bob',
			sort: '-created_at',
			'page[number]': 2,
			'page[size]': 10,
		});
		expect(params.hasFilters()).toBe(true);
		expect(params.hasSortField('created_at')).toBe(true);
		expect(params.getPagingParameters()).toBeDefined();
	});
});
