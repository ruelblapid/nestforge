/**
 * Copyright (C) RBL Solution 2026
 * All Rights Reserved.
 */

import CacheParameter from './CacheParameter';
import DownloadParameter from './DownloadParameter';
import FilterParameters from './FilterParameters';
import PagingParameter from './PagingParameter';
import RouteParameter from './RouteParameter';
import SortParameter from './SortParameter';
import UserParameter from './UserParameter';
import FieldSetParameters from './FieldSetParameters';

export interface IParameters {
	getFilterParameters(): FilterParameters;
	getIncludes(): string[];
	getPagingParameters(): PagingParameter;
	getSortParameters(): Array<SortParameter>;
	getCacheParameters(): CacheParameter;
	getRouteParameter(): RouteParameter;
	getUserParameter(): UserParameter;
	getDownloadParameters(): DownloadParameter;
	getFieldSetParameters(): FieldSetParameters;
	toQueryString(exclude?: string[]): string;

	hasFieldSets(): boolean;

	hasIncludes(): boolean;
	hasFilters(): boolean;

	removeSortParameter(field: string): void;
	hasSort(): boolean;
	hasSortField(field: string): boolean;
}

export default class Parameters implements IParameters {
	private _includes: string[];
	private _filterParameters: FilterParameters;
	private _sortParameters: Array<SortParameter>;
	private _pagingParameters: PagingParameter;
	private _routeParameters: RouteParameter;
	private _cacheParameters: CacheParameter;
	private _userParameter: UserParameter;
	private _downloadParameter: DownloadParameter;
	private _fieldSetParameters: FieldSetParameters;
	constructor(
		filterParameters: FilterParameters,
		includes?: string[],
		pagingParameters?: PagingParameter,
		sortParameters?: Array<SortParameter>,
		routeParameters?: RouteParameter,
		cacheParameters?: CacheParameter,
		userParameter?: UserParameter,
		downloadParameter?: DownloadParameter,
		fieldSetParameters?: FieldSetParameters
	) {
		this._filterParameters = filterParameters;
		this._includes = includes;
		this._pagingParameters = pagingParameters;
		this._sortParameters = sortParameters;
		this._routeParameters = routeParameters;
		this._cacheParameters = cacheParameters;
		this._userParameter = userParameter;
		this._downloadParameter = downloadParameter;
		this._fieldSetParameters = fieldSetParameters;
	}

	getFieldSetParameters(): FieldSetParameters {
		return this._fieldSetParameters;
	}

	getDownloadParameters(): DownloadParameter {
		return this._downloadParameter;
	}

	getUserParameter(): UserParameter {
		return this._userParameter;
	}

	getFilterParameters(): FilterParameters {
		return this._filterParameters;
	}

	getIncludes(): string[] {
		return this._includes;
	}

	getPagingParameters(): PagingParameter {
		return this._pagingParameters;
	}

	getSortParameters(): Array<SortParameter> {
		return this._sortParameters;
	}

	getRouteParameter(): RouteParameter {
		return this._routeParameters;
	}

	getCacheParameters(): CacheParameter {
		return this._cacheParameters;
	}

	hasFieldSets(): boolean {
		return (
			this._fieldSetParameters !== undefined &&
			this._fieldSetParameters !== null
		);
	}

	hasIncludes(): boolean {
		return (
			this._includes !== undefined &&
			this._includes !== null &&
			Array.isArray(this._includes) &&
			this._includes.length > 0
		);
	}

	hasFilters(): boolean {
		return (
			this._filterParameters !== undefined &&
			this._filterParameters !== null
		);
	}

	hasSort(): boolean {
		return (
			Array.isArray(this._sortParameters) &&
			this._sortParameters.length > 0
		);
	}

	hasSortField(field: string): boolean {
		return (
			this.hasSort() &&
			this._sortParameters.find((s) => s.getField() == field) !==
				undefined
		);
	}

	removeSortParameter(field: string): void {
		this._sortParameters = this._sortParameters.filter(
			(p) => p.getField() != field
		);
	}

	toQueryString(exclude: string[] = []): string {
		let query = '';

		if (
			!exclude.includes('includes') &&
			Array.isArray(this._includes) &&
			this._includes.length
		) {
			query += 'include=' + this._includes.join(',');
		}
		if (!exclude.includes('filters') && this._filterParameters) {
			query +=
				(query.length ? '&' : '') +
				this._filterParameters.toQueryString();
		}

		if (!exclude.includes('paging') && this._pagingParameters) {
			query +=
				(query.length ? '&' : '') +
				this._pagingParameters.toQueryString();
		}

		if (
			!exclude.includes('sort') &&
			Array.isArray(this._sortParameters) &&
			this._sortParameters.length
		) {
			query +=
				(query.length ? '&' : '') +
				'sort=' +
				this._sortParameters.map((p) => p.toQueryString()).join(',');
		}

		if (!exclude.includes('cache') && this._cacheParameters) {
			query +=
				(query.length ? '&' : '') +
				this._cacheParameters.toQueryString();
		}

		if (!exclude.includes('route') && this._routeParameters) {
			query +=
				(query.length ? '&' : '') +
				this._routeParameters.toQueryString();
		}

		if (!exclude.includes('download') && this._downloadParameter) {
			query +=
				(query.length ? '&' : '') +
				this._downloadParameter.toQueryString();
		}

		if (!exclude.includes('fieldsets') && this._fieldSetParameters) {
			query +=
				(query.length ? '&' : '') +
				this._fieldSetParameters.toQueryString();
		}
		return query;
	}
}
