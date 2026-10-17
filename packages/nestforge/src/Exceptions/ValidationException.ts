import ApiException from './ApiException';
export default class ValidationException extends ApiException {
	constructor(public readonly errors: Record<string, string[]>) {
		super('Validation failed', 422);
	}

	getErrors() {
		return this.errors;
	}
}
