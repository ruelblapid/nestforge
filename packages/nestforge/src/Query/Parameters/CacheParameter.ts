/**
 * Copyright (C) RBL Solution 2026
 * All Rights Reserved.
 */
export default class CacheParameter {
	private status: boolean;
	private clear: boolean;
	private expiration: number;
	private key: string;
	private tags: string[];

	constructor(parameters: Map<string, any>) {
		this.status =
			parameters && parameters.has('status')
				? parameters.get('status')
				: false;
		this.clear =
			parameters && parameters.has('clear')
				? parameters.get('clear')
				: false;
		this.expiration =
			parameters && parameters.has('expiration')
				? parameters.get('expiration')
				: 1;
		this.key =
			parameters && parameters.has('key') ? parameters.get('key') : null;
		this.tags =
			parameters && parameters.has('tags') ? parameters.get('tags') : [];
	}

	getStatus(): boolean {
		return this.status;
	}

	isClear(): boolean {
		return this.clear;
	}

	getExpiration(): number {
		return this.expiration;
	}

	getKey(): string {
		return this.key;
	}

	getTags(): string[] {
		return this.tags;
	}

	toQueryString(): string {
		let query = `cache[status]=${this.status}&cache[clear]=${this.clear}&cache[expiration]=${this.expiration}`;
		if (this.key) {
			query += `cache[key]=${this.key}`;
		}

		if (this.tags.length) {
			query += `cache[tags]=${this.tags.join(',')}`;
		}
		return query;
	}
}
