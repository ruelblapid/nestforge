import { CodedError } from './DataError';

/** Builds a `CodedError`: `errorCode` for clients, `status` as the HTTP status, `details` merged into the response body. */
export const codedError = (
	errorCode: string,
	message: string,
	status = 400,
	details?: Record<string, unknown>,
): CodedError => ({ kind: 'CodedError', message, code: status, errorCode, ...(details ? { details } : {}) });
