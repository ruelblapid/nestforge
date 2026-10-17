export interface IIdentifiable {
	id: { toString(): string } | string;
}

export default class UserParameter<
	TUser extends IIdentifiable = IIdentifiable,
> {
	constructor(private user: Map<string, any> | TUser) {}

	getId(): string {
		return this.user instanceof Map
			? this.user.get('id')
			: this.user.id.toString();
	}

	getUser(): Map<string, any> | TUser {
		return this.user;
	}

	toQueryString(): string {
		return `user[id]=${this.getId()}`;
	}
}
