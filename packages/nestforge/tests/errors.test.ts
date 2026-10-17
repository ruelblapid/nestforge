import 'reflect-metadata';
import { HttpException, Logger } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ApiException, ApiExceptionFilter, codedError, Either, EitherInterceptor, ErrorInfo } from '../src';

function host() {
	const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
	return { res, host: { switchToHttp: () => ({ getResponse: () => res }) } as never };
}

function respond(filter: ApiExceptionFilter, exception: unknown) {
	const { res, host: h } = host();
	filter.catch(exception, h);
	return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
}

describe('ApiException', () => {
	it('keeps the optional error code and details', () => {
		const e = new ApiException('nope', 409, { errorCode: 'CLAIM_CHANGED', details: { claimId: 'c1' } });
		expect(e.getCode()).toBe(409);
		expect(e.getErrorCode()).toBe('CLAIM_CHANGED');
		expect(e.getDetails()).toEqual({ claimId: 'c1' });
	});

	it('still works with just a message and status', () => {
		const e = new ApiException('bad', 422);
		expect(e.getErrorCode()).toBeUndefined();
		expect(e.getDetails()).toBeUndefined();
	});
});

describe('EitherInterceptor with coded errors', () => {
	const intercept = (value: unknown) =>
		lastValueFrom(new EitherInterceptor().intercept({} as never, { handle: () => of(value) }));

	it('passes plain values and Right through', async () => {
		expect(await intercept({ a: 1 })).toEqual({ a: 1 });
		expect(await intercept(Either.right(5))).toBe(5);
	});

	it('throws an ApiException carrying the error code, status and details', async () => {
		const err = (await intercept(Either.left(codedError('COVERAGE_MISSING', 'No coverage', 409, { planId: 'p1' }))).catch((e) => e)) as ApiException;
		expect(err).toBeInstanceOf(ApiException);
		expect(err.getCode()).toBe(409);
		expect(err.getErrorCode()).toBe('COVERAGE_MISSING');
		expect(err.getDetails()).toEqual({ planId: 'p1' });
	});

	it('falls back to 400 when a Left has no numeric status', async () => {
		const err = (await intercept(Either.left({ kind: 'UnauthorizedError', message: 'x', code: 'weird' })).catch((e) => e)) as ApiException;
		expect(err.getCode()).toBe(400);
	});
});

describe('ApiExceptionFilter', () => {
	it('writes the default body, including error code and details when present', () => {
		const { status, body } = respond(new ApiExceptionFilter(), new ApiException('Gone', 404, { errorCode: 'NOT_FOUND', details: { id: 1 } }));
		expect(status).toBe(404);
		expect(body).toEqual({ success: false, statusCode: 404, message: 'Gone', errorCode: 'NOT_FOUND', details: { id: 1 } });
	});

	it('keeps the original body shape when there is no code or details', () => {
		expect(respond(new ApiExceptionFilter(), new ApiException('bad', 400)).body).toEqual({ success: false, statusCode: 400, message: 'bad' });
	});

	it('maps Nest HttpExceptions', () => {
		const { status, body } = respond(new ApiExceptionFilter(), new HttpException({ message: 'Validation failed', errors: { a: ['x'] } }, 400));
		expect(status).toBe(400);
		expect(body).toMatchObject({ message: 'Validation failed', errors: { a: ['x'] } });
	});

	it('answers 500 with a generic message and logs the real error', () => {
		const spy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		const { status, body } = respond(new ApiExceptionFilter(), new Error('db password is hunter2'));
		expect(status).toBe(500);
		expect(body.message).toBe('Internal server error');
		expect(JSON.stringify(body)).not.toContain('hunter2');
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('hunter2'));
		spy.mockRestore();
	});

	it('lets an app change the wire format by overriding body()', () => {
		class LegacyFilter extends ApiExceptionFilter {
			protected override body(e: ErrorInfo) {
				return { code: e.errorCode ?? 'ERROR', message: e.message, ...e.details };
			}
		}
		const { body } = respond(new LegacyFilter(), new ApiException('Illegal', 409, { errorCode: 'ILLEGAL_TRANSITION', details: { from: 'paid', to: 'draft' } }));
		expect(body).toEqual({ code: 'ILLEGAL_TRANSITION', message: 'Illegal', from: 'paid', to: 'draft' });
	});

	it('hands the original exception to the override for formats that need more', () => {
		class Probe extends ApiExceptionFilter {
			protected override body(e: ErrorInfo) {
				return { original: e.exception instanceof HttpException };
			}
		}
		expect(respond(new Probe(), new HttpException('x', 400)).body).toEqual({ original: true });
	});
});
