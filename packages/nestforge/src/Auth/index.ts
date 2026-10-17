export interface IPermissions {
	isNotProtectedUrl(request: { method: string; url: string }): boolean;
}

export interface IPermissionService {
	getPermissions(): IPermissions;
}

export interface IAuthenticationService<TUser = unknown> {
	getUser(): Promise<TUser | null>;
}
