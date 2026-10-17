export class FieldSet {
	constructor(
		public entity: string,
		public columns: string[]
	) {}

	toQueryString(): string {
		return `fields[${this.entity}]=${this.columns.join(',')}`;
	}
}
