/**
 * Copyright (C) RBL Solution 2026
 * All Rights Reserved.
 */

import { Buffer } from 'buffer';
export class Identifier<T> {
	constructor(protected value?: T) {
		this.value = value;
	}

	equals(id?: Identifier<T>): boolean {
		if (id === null || id === undefined) {
			return false;
		}
		if (!(id instanceof this.constructor)) {
			return false;
		}
		return id.toValue() === this.value;
	}

	toString() {
		return String(this.value);
	}

	toValue(): T {
		return this.value;
	}

	protected _uuidToInt(uuid: string): number {
		// convert to integer - see answers to https://stackoverflow.com/q/39346517/2860309
		const buffer = Buffer.from(uuid);

		const result = buffer.readUInt32BE(0);

		return result;
	}
}
