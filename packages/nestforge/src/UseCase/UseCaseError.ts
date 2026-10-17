import { IUseCaseError } from './DataError';

export abstract class UseCaseError implements IUseCaseError {
	public readonly code: number;
	public readonly message: string;
	public readonly error: Error;

	constructor(message: string, code?: number, error?: Error) {
		this.message = message;
		this.code = code;
		this.error = error;
	}
}
