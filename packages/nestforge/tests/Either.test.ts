import { describe, expect, it } from 'vitest';
import { Either } from '../src';

describe('Either', () => {
	it('right holds a success value', () => {
		const result = Either.right<string, number>(42);
		expect(result.isRight()).toBe(true);
		expect(result.getRight()).toBe(42);
	});

	it('left holds an error value', () => {
		const result = Either.left<string, number>('boom');
		expect(result.isLeft()).toBe(true);
		expect(result.getLeft()).toBe('boom');
	});
});
