import { ArgumentMetadata, BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodError, ZodType } from 'zod';

export function formatZodError(error: ZodError): Record<string, string[]> {
	const formatted: Record<string, string[]> = {};
	for (const issue of error.issues) {
		const path = issue.path.join('.') || '_';
		(formatted[path] ??= []).push(issue.message);
	}
	return formatted;
}

/**
 * Validates a value against a Zod schema.
 *
 *   @Body(new ZodValidationPipe(registerSchema)) dto: RegisterInput
 */
export class ZodValidationPipe<T = unknown> implements PipeTransform<unknown, T> {
	constructor(private readonly schema: ZodType<T>) {}

	transform(value: unknown, _metadata?: ArgumentMetadata): T {
		const result = this.schema.safeParse(value);
		if (!result.success) {
			throw new BadRequestException({
				message: 'Validation failed',
				errors: formatZodError(result.error),
			});
		}
		return result.data;
	}
}
