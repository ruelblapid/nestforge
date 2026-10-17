import { DataError, Either } from 'nestforge';

/** Builders for nestforge `DataError` values; `code` is the HTTP status used by EitherInterceptor. */
export const validationError = (message: string): DataError => ({ kind: 'BadRequestError', message, code: 400 });
export const conflictError = (message: string): DataError => ({ kind: 'BadRequestError', message, code: 409 });
export const unauthorizedError = (message = 'Invalid credentials'): DataError => ({
	kind: 'UnauthorizedError',
	message,
	code: 401,
});
export const notFoundError = (message: string): DataError => ({ kind: 'BadRequestError', message, code: 404 });

export type Result<T> = Either<DataError, T>;
export const ok = <T>(value: T): Result<T> => Either.right<DataError, T>(value);
export const fail = <T = never>(error: DataError): Result<T> => Either.left<DataError, T>(error);
