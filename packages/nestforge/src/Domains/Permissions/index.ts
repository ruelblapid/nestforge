import IRepository from '../../IRepository';

export type IPermissionProperties = {
	permission_id?: string;
	code?: string;
};

export type IPermissionDocument = {
	code: string;
};

export interface PermissionSummaryResponse {
	permission_id: string;
	code: string;
}

export interface IPermissionRepository extends IRepository {}
