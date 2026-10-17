/**
 * Copyright (C) RBL Solution 2026
 * All Rights Reserved.
 */
export default class PagingParameter {
	private page: number;
	private size: number;

	constructor(parameters: Map<string, number>) {
		this.page =
			parameters && parameters.has('number')
				? parameters.get('number')
				: 1;
		this.size =
			parameters && parameters.has('size') ? parameters.get('size') : 50;
	}

	getPage(): number {
		return this.page;
	}

	getSize(): number {
		return this.size;
	}

	toQueryString() {
		return `page[number]=${this.getPage()}&page[size]=${this.getSize()}`;
	}
}
