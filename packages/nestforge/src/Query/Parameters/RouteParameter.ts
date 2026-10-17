/**
 * Copyright (C) RBL Solution 2026
 * All Rights Reserved.
 */

import { URLSearchParams } from 'url';
export default class RouteParameter {
	private name: string;
	private path: string;
	private parameter: Map<string, any>;

	constructor(name: string, path: string, parameter?: Map<string, any>) {
		this.name = name;
		this.path = path;
		this.parameter = parameter;
	}

	getName(): string {
		return this.name;
	}

	getPath(): string {
		return this.path;
	}

	getParameter(): Map<string, any> {
		return this.parameter;
	}

	toQueryString(): string {
		// Array.from(this.parameter) converts the Map into a [key, value][] matrix
		const entries = Object.entries(this.parameter ?? {});
		const searchParams = entries
			? new URLSearchParams(Array.from(entries)).toString()
			: '';

		return `route[name]=${this.name}&route[path]=${this.path}${searchParams ? '&' + searchParams : ''}`;
	}
}
