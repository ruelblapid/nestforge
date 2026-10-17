import { HttpFile } from './Http/HttpFile';
export interface IStorageService {
	upload(file: HttpFile, path: string): Promise<string>;
	getPublicAssetUrl(filePath: string): Promise<string>;
	getPrivateAssetUrl(filePath: string): Promise<string>;
}
