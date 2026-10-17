import { FieldSet } from './FieldSet';
export default class FieldSetParameters {
	constructor(public fields: FieldSet[]) {}

	toQueryString(): string {
		return this.fields.map((field) => field.toQueryString()).join('&');
	}

	getFieldSets(): FieldSet[] {
		return this.fields;
	}

	getFieldSetByEntity(entity: string): FieldSet {
		return this.fields.find((f) => f.entity == entity);
	}
}
