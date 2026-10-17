import {
	BadRequestException,
	createParamDecorator,
	ExecutionContext,
	Injectable,
	PipeTransform,
} from '@nestjs/common';
import { QueryParameters, QueryParser } from '../Query';
import { IParameters } from '../Query/Parameters';
import { QueryValidationException, validateQuery } from '../Query/Validator';

/**
 * Turns a flat query string (`filter[name][contains]=x&sort=-created_at&page[number]=2`)
 * into an `IParameters` instance.
 */
@Injectable()
export class QueryParametersPipe implements PipeTransform<Record<string, any>, IParameters> {
	transform(value: Record<string, any>): IParameters {
		return new QueryParameters().parse(QueryParser.parse(value ?? {}));
	}
}

/**
 * `@Params()` — injects parsed filter / sort / paging / fields parameters.
 * If the handler is decorated with `@QuerySchema(...)`, the query is validated against it first
 * and a 400 listing every violation is returned. If `request.user` is set, it is exposed as the
 * user parameter.
 */
export const Params = createParamDecorator((_data: unknown, ctx: ExecutionContext): IParameters => {
	const req = ctx.switchToHttp().getRequest();
	const map = QueryParser.parse(req.query ?? {});
	try {
		validateQuery(ctx.getClass(), ctx.getHandler().name, map);
	} catch (e) {
		if (e instanceof QueryValidationException) {
			throw new BadRequestException({ message: e.message, errors: e.details });
		}
		throw e;
	}
	if (req.user) map.set('user', req.user);
	return new QueryParameters().parse(map);
});
