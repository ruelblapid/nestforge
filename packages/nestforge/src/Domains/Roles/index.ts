import IRepository from '../../IRepository';
import { QueryResponse } from '../../UseCase';
import { IParameters } from '../../Query/Parameters';

export type IRoleProperties = {
	role_id?: string;
	tenant_id?: string | null;
	code?: string;
	name?: string;
	description?: string | null;
	is_system?: boolean;
	status?: string;
	version?: number;
	created_at?: Date;
	updated_at?: Date | null;
	deleted_at?: Date | null;
};

export type IRoleDocument = {
	tenant_id?: string | null;
	code: string;
	name: string;
	description?: string | null;
	is_system: boolean;
	status: string;
	permission_ids?: string[];
};

export interface RoleSummaryResponse {
	role_id: string;
	tenant_id?: string | null;
	code: string;
	name: string;
	description?: string | null;
	is_system: boolean;
	status: string;
	version?: string | null;
	created_at?: string | null;
	updated_at?: string | null;
	deleted_at?: string | null;
}

export interface RoleDropdownItemResponse {
	role_id: string;
	name: string;
}

export interface IRoleRepository extends IRepository {
	getRoleByCode(
		code: string,
		parameter?: IParameters
	): Promise<QueryResponse>;
	getRolePermissions(role_id: string): Promise<string[]>;
}
