/**
 * Copyright (C) RBL Solution 2026
 * All Rights Reserved.
 */
import { Filter } from './Filter';
import { FilterField } from './FilterField';
import { FilterOperator } from './FilterOperator';
import { FilterValue } from './FilterValue';
export default class FilterParameters {
	private filters: Array<Filter>;
	constructor(filters: Array<Filter>) {
		this.filters = filters;
	}

	getFilters(): Array<Filter> {
		return this.filters;
	}

	public addFilter(column: string, operation: string, value: any) {
		if (!Array.isArray(this.filters) || this.filters.length == 0) {
			this.filters = new Array<Filter>();
		}
		this.filters.push(
			new Filter(
				new FilterField(column),
				FilterOperator.fromValue(operation),
				new FilterValue(value)
			)
		);
	}

	public getFilter(column: string): Filter {
		if (Array.isArray(this.filters) && this.filters.length) {
			const filter = this.filters.find(
				(filter) => filter.field.value == column
			);
			return filter;
		}
		return null;
	}

	public hasFilter(column: string) {
		if (Array.isArray(this.filters) && this.filters.length) {
			const filter = this.getFilter(column);
			return filter !== undefined && filter !== null;
		}

		return false;
	}

	toQueryString(): string {
		return this.filters
			? this.filters
					.map((filter: Filter) => {
						const operator = filter.operator
							? `[${filter.operator.value}]`
							: '';
						return `filter[${filter.field.value}]${operator}=${filter.value.value}`;
					})
					.join('&')
			: '';
	}
}
