/**
 * Copyright (C) RBL Solution 2026
 * All Rights Reserved.
 */
export default class DownloadParameter {
	private _format: string;
	private _isDownload: boolean;
	//private _allowedFormat: Array<string> = new Array<string>(...['CSV', 'XLS', 'XLSX', 'JSON'])

	constructor(parameters: Map<string, any>) {
		this._format =
			parameters && parameters.has('format')
				? parameters.get('format').toUpperCase()
				: 'JSON';
		this._isDownload =
			parameters && parameters.has('status') && parameters.get('status');
	}

	getFormat(): string {
		return this._format;
	}

	isDownload(): boolean {
		return this._isDownload;
	}

	toQueryString(): string {
		return `download[format]=${this._format}`;
	}
}
