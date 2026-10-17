import { registerQuerySchema } from './Registry';
import { QuerySchemaConfig } from './Types';

/**
 * Registers a query validation schema against a controller method.
 * The router reads this before building IParameters and throws
 * BadRequestException on violation.
 *
 * @example
 * \@Get('')
 * \@QuerySchema({
 *   filters: {
 *     level_id: { type: FilterValueType.UUID },
 *     site_id:  { type: FilterValueType.UUID, operators: [Operator.CONTAINS] },
 *   },
 *   includes: ['anchors', 'sites'],
 *   fields: {
 *     anchors: { columns: ['id', 'name'] },
 *   },
 *   pagination: true,
 * })
 * async getList(parameters?: IParameters): Promise<CommandResponse> { ... }
 */
export function QuerySchema(config: QuerySchemaConfig): MethodDecorator {
	return (
		target: object,
		propertyKey: string | symbol,
		_descriptor: PropertyDescriptor
	) => {
		// target is the prototype — target.constructor is the controller class
		registerQuerySchema(
			target.constructor as Function,
			propertyKey,
			config
		);
	};
}
