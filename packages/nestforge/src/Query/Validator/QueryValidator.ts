import { buildZodSchema } from './SchemaBuilder';
import { getQuerySchema } from './Registry';

import { QueryMap } from '../index';
import { QuerySchemaConfig } from './Types';

// Built Zod schemas are immutable per config, so build once.
const schemaCache = new WeakMap<QuerySchemaConfig, ReturnType<typeof buildZodSchema>>();

export interface QueryValidationError {
	field: string;
	message: string;
}

export class QueryValidationException extends Error {
	public readonly status = 400;
	public readonly details: QueryValidationError[];

	constructor(details: QueryValidationError[]) {
		super('Invalid query parameters');
		this.name = 'QueryValidationException';
		this.details = details;
	}

	toResponse() {
		return {
			code: 400,
			error: 'Bad Request',
			message: this.message,
			errors: this.details,
		};
	}
}

/**
 * Validates a parsed QueryMap against the @QuerySchema config registered
 * for the given controller + method.
 *
 * Call this in the router right after QueryParser.parse() and before
 * queryParser.parse(query) builds IParameters.
 *
 * Throws QueryValidationException on failure — the router should catch it
 * and return a 400 response.
 *
 * @param controllerClass  The controller class (e.g. SiteLevelsController)
 * @param methodName       The handler method name (e.g. 'getList')
 * @param query            The QueryMap returned by QueryParser.parse()
 */
export function validateQuery(
	controllerClass: Function,
	methodName: string,
	query: QueryMap
): void {
	const schemaMeta = getQuerySchema(controllerClass, methodName);
	if (!schemaMeta) return;

	let zodSchema = schemaCache.get(schemaMeta.config);
	if (!zodSchema) {
		zodSchema = buildZodSchema(schemaMeta.config);
		schemaCache.set(schemaMeta.config, zodSchema);
	}

	// Flatten top-level Map to plain object for Zod
	const toValidate: Record<string, any> = {};
	for (const [key, val] of query.entries()) {
		if (key === 'user' || key === 'route') continue;
		toValidate[key] = val;
	}

	const result = zodSchema.safeParse(toValidate);
	if (!result.success) {
		const errors: QueryValidationError[] = result.error.issues.map(
			(issue) => ({
				field: issue.path.join('.') || 'query',
				message: issue.message,
			})
		);
		throw new QueryValidationException(errors);
	}
}
