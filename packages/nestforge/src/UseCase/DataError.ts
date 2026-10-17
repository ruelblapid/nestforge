export interface UnexpectedError {
	kind: 'UnexpectedError';
	error?: Error;
	message?: string;
}

export interface NoRecordFoundError {
	kind: 'NoRecordFoundError';
	message: string;
}

export interface QueryError {
	kind: 'QueryError';
	message: string;
}

export interface ValidationError {
	kind: 'ValidationError';
	message: string;
	errors?: Record<string, string>[];
}

export interface ServerError {
	kind: 'ServerError';
	error: Error;
	errorCode: number;
}

export interface AuthenticationError {
	kind: 'AuthenticationError';
	message: string;
	error?: Error;
}

export interface UnauthorizedError {
	kind: 'UnauthorizedError';
	message: string;
	code?: number | string;
}

export interface BadRequestError {
	kind: 'BadRequestError';
	message: string;
	code?: number;
}

export interface ErrorData {
	message: string;
	source: string;
	value: string;
}

export interface ErrorFold {
	kind: 'ErrorFold';
	error: ErrorData[];
}

export interface IUseCaseError {
	kind?: 'IUseCaseError';
	code?: number;
	title?: string;
	message: string;
	error?: Error;
}

export type DataError =
	| UnexpectedError
	| NoRecordFoundError
	| ServerError
	| AuthenticationError
	| UnauthorizedError
	| BadRequestError
	| ErrorFold
	| IUseCaseError
	| QueryError
	| ValidationError;
