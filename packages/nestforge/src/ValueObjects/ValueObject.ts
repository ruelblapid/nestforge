/**
 * Copyright (C) RBL Solution 2026
 * All Rights Reserved.
 */
import { shallowEqual } from 'shallow-equal-object';

interface ValueObjectProps {
	[index: string]: any;
}

export abstract class ValueObject<T extends ValueObjectProps> {
	public readonly properties: T;

	constructor(properties: T) {
		this.properties = Object.freeze(properties);
	}

	public equals(vo?: ValueObject<T>): boolean {
		if (vo === null || vo === undefined) {
			return false;
		}
		if (vo.properties === undefined) {
			return false;
		}
		return shallowEqual(this.properties, vo.properties);
	}
}
