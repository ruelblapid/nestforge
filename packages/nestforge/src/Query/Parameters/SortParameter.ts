/**
 * Copyright (C) RBL Solution 2026
 * All Rights Reserved.
 */
export default class SortParameter {
	private _sortField: string;
	private _isAscending: boolean;

	constructor(sortField: string, isAscending: boolean) {
		this._sortField = sortField;
		this._isAscending = isAscending;
	}

	getField(): string {
		return this._sortField;
	}

	isAscending(): boolean {
		return this._isAscending;
	}

	isDescending(): boolean {
		return !this._isAscending;
	}

	toQueryString(): string {
		return `${this.isAscending() ? '' : '-'}${this._sortField}`;
	}
}
