import { QuerySchemaConfig } from './Types';

export interface QuerySchemaMetadata {
	target: Function;

	methodName: string | symbol;

	config: QuerySchemaConfig;
}

export const querySchemaRegistry = new Map<string, QuerySchemaMetadata>();

/** Build the registry key for a given controller + method pair. */
export function buildRegistryKey(
	target: Function,
	methodName: string | symbol
): string {
	return `${target.name}.${String(methodName)}`;
}

/** Register a QuerySchemaConfig for a controller method. */
export function registerQuerySchema(
	target: Function,
	methodName: string | symbol,
	config: QuerySchemaConfig
): void {
	const key = buildRegistryKey(target, methodName);
	querySchemaRegistry.set(key, { target, methodName, config });
}

/** Retrieve a QuerySchemaConfig for a controller method. Returns undefined if not registered. */
export function getQuerySchema(
	target: Function,
	methodName: string | symbol
): QuerySchemaMetadata | undefined {
	const key = buildRegistryKey(target, methodName);
	return querySchemaRegistry.get(key);
}
