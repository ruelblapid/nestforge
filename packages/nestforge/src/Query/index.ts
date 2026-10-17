/**
 * Copyright (C) RBL Solution 2026
 * All Rights Reserved.
 */
import BadRequestException from '../Exceptions/BadRequestException';
import { IParameters } from './Parameters';

import CacheParameter from './Parameters/CacheParameter';
import DownloadParameter from './Parameters/DownloadParameter';
import { Filter } from './Parameters/Filter';
import { FilterField } from './Parameters/FilterField';
import { Operator, FilterOperator } from './Parameters/FilterOperator';
import FilterParameters from './Parameters/FilterParameters';
import { FilterValue } from './Parameters/FilterValue';
import Parameters from './Parameters/index';
import PagingParameter from './Parameters/PagingParameter';
import RouteParameter from './Parameters/RouteParameter';
import SortParameter from './Parameters/SortParameter';
import UserParameter, { IIdentifiable } from './Parameters/UserParameter';
import FieldSetParameters from './Parameters/FieldSetParameters';
import { FieldSet } from './Parameters/FieldSet';

// Values here must stay in the *named* form (matching the literal URL
// segment, e.g. 'gte') rather than the symbolic SQL operator ('>=') — the
// translated value flows straight into QueryValidator/SchemaBuilder before
// _parseFilters() below converts it to SQL, and the validator's allowed-
// operator config (Shared/Query/Validator/Types.ts) is written in terms of
// the named form.
const OPERATOR_MAP: Record<string, Operator> = {
	contains: Operator.NAMED_CONTAINS,
	equals: Operator.EQUAL,
	not_eq: Operator.NAMED_NOT_EQ,
	gt: Operator.NAMED_GT,
	lt: Operator.NAMED_LT,
	gte: Operator.NAMED_GTE,
	lte: Operator.NAMED_LTE,
	between: Operator.NAMED_BETWEEN,
};

export interface IQueryParameters {
	parse(parameter: Map<string, any>): IParameters;
}

export class QueryParameters implements IQueryParameters {
	parse(parameters: Map<string, any>): IParameters {
		return new Parameters(
			this.getFilterParameters(parameters.get('filter')),
			this.getIncludeParameter(parameters.get('include')),
			this.getPagingParameter(parameters.get('page')),
			this.getSortParameter(parameters.get('sort')),
			this.getRouteParameters(parameters.get('route')),
			this.getCacheParameters(parameters.get('cache')),
			this.getUserParameters(parameters.get('user')),
			this.getDownloadParameter(parameters.get('download')),
			this.getFieldSetParameters(parameters.get('fields'))
		);
	}

	private getDownloadParameter(
		parameters?: Map<string, string>
	): DownloadParameter {
		return new DownloadParameter(parameters);
	}

	private getFilterParameters(
		parameter?: Map<string, any>
	): FilterParameters {
		const filters = this._parseFilters(parameter);
		return new FilterParameters(filters);
	}

	private getIncludeParameter(parameter?: string | string[]): string[] {
		if (Array.isArray(parameter)) {
			return parameter;
		}
		let includes: string[] = [];
		if (parameter && parameter.length) {
			includes = parameter.trim().split(',');
		}
		return includes;
	}

	private getSortParameter(
		parameter?: string | string[]
	): Array<SortParameter> {
		const sortParameters: Array<SortParameter> = new Array<SortParameter>();
		if (parameter && parameter.length) {
			const sorts = Array.isArray(parameter)
				? parameter
				: parameter.trim().split(',');
			for (const sort of sorts) {
				const param = sort.trim().charAt(0);
				const isDesc = param == '-';
				const field = sort.replace('-', '').replace('+', '');
				sortParameters.push(new SortParameter(field, !isDesc));
			}
		}
		return sortParameters;
	}

	private getPagingParameter(parameters?: Map<string, number>) {
		return new PagingParameter(parameters);
	}

	private getRouteParameters(parameters?: Map<string, any>): RouteParameter {
		return new RouteParameter(
			this._getParamOrNull('name', parameters),
			this._getParamOrNull('path', parameters),
			this._getParamOrNull('parameters', parameters)
		);
	}

	private getUserParameters(
		parameters?: Map<string, any> | IIdentifiable
	): UserParameter {
		return new UserParameter(parameters);
	}

	private getFieldSetParameters(
		parameters?: Map<string, any>
	): FieldSetParameters {
		if (parameters) {
			const fieldSets: FieldSet[] = [];
			for (const [key, value] of parameters) {
				const fieldSet = new FieldSet(key, value);
				fieldSets.push(fieldSet);
			}
			return new FieldSetParameters(fieldSets);
		}
		return null;
	}

	private getCacheParameters(parameters?: Map<string, any>): CacheParameter {
		return new CacheParameter(parameters);
	}

	_getArrayParamOrNull(key: string, parameters?: Map<string, any>) {
		const value = this._getParamOrNull(key, parameters);
		if (null !== value && !Array.isArray(parameters)) {
			throw new BadRequestException(
				'Value should be either an array or null.'
			);
		}

		return value;
	}

	_getParamOrNull(key: string, parameters?: Map<string, any>): any {
		return parameters && parameters.has(key) ? parameters.get(key) : null;
	}

	_getStringParamOrNull(key: string, parameters?: Map<string, any>): string {
		const value = this._getParamOrNull(key, parameters);

		if (null !== value && typeof value === 'string') {
			throw new BadRequestException(
				'Value should be either a string or null.'
			);
		}

		return value;
	}
	protected _parseFilters(params?: Map<string, any>): Array<Filter> {
		if (!params) {
			return new Array<Filter>();
		}

		const filters = new Array<Filter>();
		for (const [key, value] of params) {
			const operator = value[0];
			const filterValue = value[1];

			switch (operator) {
				case Operator.NAMED_CONTAINS:
				case Operator.CONTAINS:
					filters.push(
						new Filter(
							new FilterField(key),
							FilterOperator.fromValue('ILIKE'),
							new FilterValue(filterValue)
						)
					);
					break;

				case Operator.NAMED_NOT_CONTAINS:
				case Operator.NOT_CONTAINS:
					filters.push(
						new Filter(
							new FilterField(key),
							FilterOperator.fromValue('NOT ILIKE'),
							new FilterValue(filterValue)
						)
					);
					break;

				case Operator.NAMED_GT:
				case Operator.GT:
					filters.push(
						new Filter(
							new FilterField(key),
							FilterOperator.fromValue('>'),
							new FilterValue(filterValue)
						)
					);
					break;

				case Operator.NAMED_GTE:
				case Operator.GTE: // '>='
					filters.push(
						new Filter(
							new FilterField(key),
							FilterOperator.fromValue('>='),
							new FilterValue(filterValue)
						)
					);
					break;

				case Operator.NAMED_LT:
				case Operator.LT:
					filters.push(
						new Filter(
							new FilterField(key),
							FilterOperator.fromValue('<'),
							new FilterValue(filterValue)
						)
					);
					break;

				case Operator.NAMED_LTE:
				case Operator.LTE: // '<='
					filters.push(
						new Filter(
							new FilterField(key),
							FilterOperator.fromValue('<='),
							new FilterValue(filterValue)
						)
					);
					break;

				case Operator.NAMED_BETWEEN:
				case Operator.BETWEEN:
					filters.push(
						new Filter(
							new FilterField(key),
							FilterOperator.fromValue('BETWEEN'),
							new FilterValue(filterValue)
						)
					);
					break;

				case Operator.NAMED_NOT_EQ:
				case Operator.NOT_EQUAL:
					filters.push(
						new Filter(
							new FilterField(key),
							FilterOperator.fromValue('!='),
							new FilterValue(filterValue)
						)
					);
					break;

				case Operator.NAMED_EQ:
				case Operator.EQUAL:
				default:
					filters.push(
						new Filter(
							new FilterField(key),
							FilterOperator.fromValue('='),
							new FilterValue(filterValue)
						)
					);
					break;
			}
		}

		return filters;
	}
}
export type FilterMap = Map<string, [Operator, any]>;
export type QueryMap = Map<string, any>;
export class QueryParser {
	public static parse(flatRecord: Record<string, any>): QueryMap {
		const query = new Map<string, any>();

		for (const [flatKey, rawValue] of Object.entries(flatRecord)) {
			if (rawValue === undefined || rawValue === null) continue;

			let value =
				typeof rawValue === 'string' && rawValue.includes(',')
					? rawValue.split(',').map((item) => item.trim())
					: rawValue;

			const keys = flatKey.match(/[^[\]]+/g);
			if (!keys) {
				query.set(flatKey, value);
				continue;
			}
			const [group, field, operatorSegment] = keys;

			if (group === 'filter' && field) {
				if (!query.has('filter')) {
					query.set('filter', new Map<string, [Operator, any]>());
				}
				const filterMap = query.get('filter') as FilterMap;

				const operator = operatorSegment
					? (OPERATOR_MAP[operatorSegment.toLowerCase()] ??
						Operator.EQUAL)
					: Operator.EQUAL;

				filterMap.set(field, [operator, value]);
				continue;
			}

			if (keys.length === 1) {
				if (group === 'sort' && !Array.isArray(value)) {
					value = [value];
				}
				query.set(group, value);
			} else {
				if (!query.has(group)) {
					query.set(group, new Map<string, any>());
				}
				const groupMap = query.get(group) as Map<string, any>;
				groupMap.set(field, value);
			}
		}

		return query;
	}
}
