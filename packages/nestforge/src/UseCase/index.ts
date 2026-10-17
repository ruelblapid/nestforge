import IDocument from '../IDocument';
import { IResponse } from '../IResponse';
import { DataError } from './DataError';
import { Either } from './Either';
import { UseCaseError } from './UseCaseError';
type QueryResponse<T = any> = Either<DataError, IResponse<T>>;
type CommandResponse<T = any> = Either<DataError, IResponse<T>>;

export interface IUseCase {
	execute(request?: IDocument): Promise<QueryResponse | CommandResponse>;
}

export {
	Either,
	UseCaseError,
	type CommandResponse,
	type DataError,
	type QueryResponse,
};
