/**
 * Copyright (C) RBL Solution 2026
 * All Rights Reserved.
 */
import IDocument from './IDocument';
import { UniqueEntityID } from './ValueObjects/UniqueEntityID';
const isEntity = (v: any): v is Entity<any> => {
	return v instanceof Entity;
};

export abstract class Entity<T = any> {
	protected readonly _id: UniqueEntityID;
	protected _version: number | undefined;
	public readonly properties: T;

	constructor(props: T, id?: UniqueEntityID) {
		this._id = id ? id : new UniqueEntityID();
		this.properties = props;
	}

	get id(): UniqueEntityID {
		return this._id;
	}

	get version(): number | undefined {
		return this._version;
	}

	incrementVersion() {
		if (this._version && typeof this._version === 'number') {
			this._version += 1;
		}
	}

	public equals(object?: Entity<T>): boolean {
		if (object == null || object == undefined) {
			return false;
		}

		if (this === object) {
			return true;
		}

		if (!isEntity(object)) {
			return false;
		}

		return this._id.equals(object._id);
	}

	public getChanges(original: IDocument, updated: IDocument): IDocument {
		const changes: IDocument = {};
		const compareObjects = (
			o: IDocument,
			u: IDocument,
			path: string = ''
		) => {
			if (
				typeof o === 'object' &&
				typeof u === 'object' &&
				o !== null &&
				u !== null
			) {
				if (Array.isArray(o) && Array.isArray(u)) {
					if (o.length !== u.length || o.some((v, i) => v !== u[i])) {
						changes[path] = { original: o, updated: u };
					}
				} else {
					const allKeys = new Set([
						...Object.keys(o),
						...Object.keys(u),
					]);
					allKeys.forEach((key) => {
						const newPath = path ? `${path}.${key}` : key;
						if (!(key in o)) {
							changes[newPath] = {
								original: undefined,
								updated: u[key],
							};
						} else if (!(key in u)) {
							changes[newPath] = {
								original: o[key],
								updated: undefined,
							};
						} else {
							compareObjects(o[key], u[key], newPath);
						}
					});
				}
			} else {
				if (o !== u) {
					changes[path] = { original: o, updated: u };
				}
			}
		};

		compareObjects(original, updated);

		return changes;
	}

	toPrimitives(): T {
		return this.properties;
	}

	toJsonString(): string {
		return JSON.stringify(this.properties);
	}
}
