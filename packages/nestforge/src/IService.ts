/**
 * Copyright (C) Anchor Tag 2026
 * All Rights Reserved.
 */
import IDocument from './IDocument';
import { IParameters } from './Query/Parameters';
import { CommandResponse, QueryResponse } from './UseCase';

export default interface IService {
	getList(parameter: IParameters): Promise<QueryResponse>;
	getById(record_id: string, parameter?: IParameters): Promise<QueryResponse>;
	create(document: IDocument): Promise<CommandResponse>;
	update(
		record_id: string,
		document: Partial<IDocument>
	): Promise<CommandResponse>;
	delete(record_id: string, document?: IDocument): Promise<CommandResponse>;
}
