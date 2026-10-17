import ValidationException from './Exceptions/ValidationException';
import { ZodType, ZodError } from 'zod';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export abstract class BaseDto<T> {
	static schema: ZodType;

	static validate<T>(data: unknown): T {
		const result = (this as any).schema.safeParse(data);
		if (!result.success) {
			throw new ValidationException(this.formatErrors(result.error));
		}
		return result.data as T;
	}

	private static formatErrors(error: ZodError): Record<string, string[]> {
		const formatted: Record<string, string[]> = {};
		for (const issue of error.issues) {
			const path = issue.path.join('.');
			if (!formatted[path]) formatted[path] = [];
			formatted[path].push(issue.message);
		}
		return formatted;
	}
}
