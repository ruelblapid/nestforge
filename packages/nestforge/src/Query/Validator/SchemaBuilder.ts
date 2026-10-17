import { z } from 'zod';
import {
	FilterFieldConfig,
	FilterValueType,
	Operator,
	QuerySchemaConfig,
} from './Types';

function buildValueSchema(field: string, cfg: FilterFieldConfig): z.ZodType {
	switch (cfg.type) {
		case FilterValueType.UUID:
			return z.uuid({
				message: `filter[${field}]: value must be a valid UUID`,
			});

		case FilterValueType.NUMBER:
			return z
				.string()
				.regex(/^\d+(\.\d+)?$/, {
					message: `filter[${field}]: value must be numeric`,
				})
				.transform(Number);

		case FilterValueType.BOOLEAN:
			return z
				.enum(
					{ true: 'true', false: 'false' },
					{
						error: () =>
							`filter[${field}]: value must be "true" or "false"`,
					}
				)
				.transform((v) => v === 'true');

		case FilterValueType.DATE:
			// Filter values arrive as raw query-string values (always
			// strings), never pre-parsed Date instances — z.date() would
			// reject every input. z.coerce.date() validates the string is
			// actually parseable as a date; the parsed Date is only used
			// for this check, not passed downstream (the original string
			// is what reaches the SQL builder).
			return z.coerce.date({
				error: `filter[${field}]: value must be an ISO 8601 date`,
			});

		case FilterValueType.ENUM: {
			const values = cfg.enumValues ?? [];
			if (values.length === 0) {
				throw new Error(
					`QuerySchema: filter field "${field}" has type ENUM but no enumValues defined`
				);
			}

			const enumObj = Object.fromEntries(
				values.map((v) => [v, v])
			) as Record<string, string>;
			return z.enum(enumObj, {
				error: () =>
					`filter[${field}]: value must be one of: ${values.join(', ')}`,
			});
		}

		case FilterValueType.STRING:
		default:
			return z.string().min(1, {
				message: `filter[${field}]: value must not be empty`,
			});
	}
}

function buildOperatorSchema(field: string, cfg: FilterFieldConfig): z.ZodType {
	const allowedOperators = cfg.operators ?? [Operator.EQUALS];
	const valueSchema = buildValueSchema(field, cfg);

	const operatorObj = Object.fromEntries(
		allowedOperators.map((op) => [op, op])
	) as Record<string, string>;

	return z.tuple([
		z.enum(operatorObj, {
			error: () =>
				`filter[${field}]: operator must be one of: ${allowedOperators.join(', ')}`,
		}),
		valueSchema,
	]);
}

export function buildZodSchema(config: QuerySchemaConfig) {
	const shape: Record<string, z.ZodType> = {};

	if (config.filters && Object.keys(config.filters).length > 0) {
		shape['filter'] = z
			.map(z.string(), z.tuple([z.string(), z.any()]))
			.optional()
			.superRefine((filterMap, ctx) => {
				if (!filterMap) return;

				for (const [field, tuple] of filterMap.entries()) {
					if (!config.filters![field]) {
						ctx.addIssue({
							code: 'custom',
							message: `filter[${field}]: unsupported filter field`,
							path: [field],
						});
						continue;
					}

					const result = buildOperatorSchema(
						field,
						config.filters![field]
					).safeParse(tuple);
					if (!result.success) {
						for (const issue of result.error.issues) {
							ctx.addIssue({
								...issue,
								path: [field, ...(issue.path ?? [])],
							});
						}
					}
				}
			});
	}

	if (config.includes && config.includes.length > 0) {
		const includeObj = Object.fromEntries(
			config.includes.map((v) => [v, v])
		) as Record<string, string>;

		shape['include'] = z
			.enum(includeObj, {
				error: (ctx) =>
					`include: "${ctx.input}" is not a supported relation. Allowed: ${config.includes!.join(', ')}`,
			})
			.optional();
	}

	if (config.fields && Object.keys(config.fields).length > 0) {
		shape['fields'] = z
			.map(z.string(), z.array(z.string()))
			.optional()
			.superRefine((fieldsMap, ctx) => {
				if (!fieldsMap) return;

				for (const [alias, columns] of fieldsMap.entries()) {
					if (!config.includes?.includes(alias)) {
						ctx.addIssue({
							code: 'custom',
							message: `fields[${alias}]: "${alias}" is not in the include list`,
							path: [alias],
						});
						continue;
					}

					const fieldsetCfg = config.fields![alias];
					if (!fieldsetCfg) {
						ctx.addIssue({
							code: 'custom',
							message: `fields[${alias}]: no column config defined for this relation`,
							path: [alias],
						});
						continue;
					}

					for (const col of columns) {
						if (!fieldsetCfg.columns.includes(col)) {
							ctx.addIssue({
								code: 'custom',
								message: `fields[${alias}]: column "${col}" is not allowed. Allowed: ${fieldsetCfg.columns.join(', ')}`,
								path: [alias, col],
							});
						}
					}
				}
			});
	}

	if (config.pagination !== false) {
		shape['page'] = z
			.map(z.string(), z.string())
			.optional()
			.superRefine((pageMap, ctx) => {
				if (!pageMap) return;

				const allowed = ['number', 'size'];
				for (const [key, val] of pageMap.entries()) {
					if (!allowed.includes(key)) {
						ctx.addIssue({
							code: 'custom',
							message: `page[${key}]: unsupported page key. Allowed: ${allowed.join(', ')}`,
							path: [key],
						});
						continue;
					}
					if (!/^\d+$/.test(val) || Number(val) < 1) {
						ctx.addIssue({
							code: 'custom',
							message: `page[${key}]: must be a positive integer`,
							path: [key],
						});
					}
				}
			});
	}

	if (config.sort && config.sort.length > 0) {
		const sortFieldSchema = z
			.string()
			.optional()
			.superRefine((val, ctx) => {
				const rawField = val.startsWith('-') ? val.slice(1) : val;
				if (rawField.length < 2) {
					ctx.addIssue({
						code: 'custom',
						minimum: 2,
						type: 'string',
						inclusive: true,
						message: `Field name '${rawField}' is too short. Minimum length is 3 characters.`,
					});
					return;
				}
				if (rawField.length > 30) {
					ctx.addIssue({
						code: 'custom',
						maximum: 30,
						type: 'string',
						inclusive: true,
						message: `Field name '${rawField}' is too long. Maximum length is 30 characters.`,
					});
					return;
				}
				if (!config.sort.includes(rawField)) {
					ctx.addIssue({
						code: 'custom',
						message: `Invalid sort field ${rawField}. Allowed fields: ${config.sort.join(', ')}`,
					});
				}
			})
			.transform((val) => {
				return val.startsWith('-') ? val.slice(1) : val;
			});

		shape['sort'] = z.array(sortFieldSchema).optional();
	}

	return z.object(shape);
}
