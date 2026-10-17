export enum Operator {
	EQUALS = '=',
	CONTAINS = 'contains',
	STARTS_WITH = 'startswith',
	ENDS_WITH = 'endswith',
	GT = 'gt',
	GTE = 'gte',
	LT = 'lt',
	LTE = 'lte',
	IN = 'in',
	NOT = 'not',
}

export enum FilterValueType {
	UUID = 'uuid',
	STRING = 'string',
	NUMBER = 'number',
	BOOLEAN = 'boolean',
	DATE = 'date',
	ENUM = 'enum',
}

export interface FilterFieldConfig {
	operators?: Operator[];

	type: FilterValueType;

	enumValues?: string[];
}

export interface FieldsetConfig {
	/** The allowed column names for this include alias. */
	columns: string[];
}

export interface QuerySchemaConfig {
	/**
	 * Allowed filter fields and their rules.
	 * Key = field name (e.g. 'level_id', 'site_id')
	 */
	filters?: Record<string, FilterFieldConfig>;

	/**
	 * Allowed include values (table names or aliases).
	 * e.g. ['test', 'test2']
	 */
	includes?: string[];

	/**
	 * Allowed fieldset keys and their permitted columns.
	 * Key must match an entry in `includes`.
	 * e.g. { test: { columns: ['id', 'name'] } }
	 */
	fields?: Record<string, FieldsetConfig>;

	/**
	 * Whether pagination is allowed on this route.
	 * Allowed keys are always 'number' and 'size'.
	 * Defaults to true.
	 */
	pagination?: boolean;

	sort?: string[];
}

export type ParsedFilter = Map<string, [Operator, any]>;

export interface ValidatedQuery {
	filter?: ParsedFilter;
	include?: string[];
	fields?: Map<string, string[]>;
	page?: { number?: number; size?: number };
	sort?: string;
}
