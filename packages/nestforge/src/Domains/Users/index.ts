import IRepository from '../../IRepository';

export interface IUserProperties {
	user_id: string;
	display_name: string;
	role: string;
	role_id: string;
	status: string;
	last_sign_in_at: Date;
}

export interface IUserRegistrationProperties {
	user_id?: string;
	display_name: string;
	role_id: string;
	status: string;
	email: string;
	password?: string;
	confirm_password?: string;
	email_confirm?: boolean;
}

export interface UserSummaryResponse {
	user_id: string;
	display_name: string;
	email: string;
	role: string;
	role_id: string;
	status: string;
	last_sign_in_at: Date;
	created_at?: string | null;
	updated_at?: string | null;
	deleted_at?: string | null;
}

export interface IUserRepository extends IRepository {
	// Multi-tenant SaaS pattern: a user can belong to more than one tenant.
	// Drop this if your project is single-tenant.
	getUserTenants?(user_id: string): Promise<string[]>;
}
