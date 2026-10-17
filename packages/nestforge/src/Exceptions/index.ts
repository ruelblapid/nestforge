import { UseCaseError } from '../UseCase/UseCaseError';

export namespace DataError {
	export const DEFAULT_ERROR_MESSAGE: string =
		'Looks like something went wrong on our end. If the issue persist, please shoot us a note so we can help out. We apologize for the inconvenience.';

	export const DEFAULT_AUTH_ERROR_MESSAGE: string =
		"Looks like something went wrong! We're having trouble understanding your request. Would you like to try again, or can we help you find something else?";

	export class UnhandledError extends UseCaseError {
		constructor(error?: Error) {
			super(DEFAULT_ERROR_MESSAGE, 400, error);
		}
	}

	export class QueryError extends UseCaseError {
		constructor(message?: string, code?: number, error?: Error) {
			//TODO: assert error type
			message = message ? message : DEFAULT_ERROR_MESSAGE;
			super(
				message,
				code ? code : 400,
				error ? error : new Error(message)
			);
		}
	}

	export class CommandError extends UseCaseError {
		constructor(message?: string, code?: number, error?: Error) {
			//TODO: assert error type
			message = message ? message : DEFAULT_ERROR_MESSAGE;
			super(
				message,
				code ? code : 400,
				error ? error : new Error(message)
			);
		}
	}
	export class AuthenticationError extends UseCaseError {
		constructor(message?: string, code?: number, error?: Error) {
			//TODO: assert error type
			message = message ? message : 'Authentication Failed.';
			super(
				message,
				code ? code : 406,
				error ? error : new Error(message)
			);
		}
	}
}
