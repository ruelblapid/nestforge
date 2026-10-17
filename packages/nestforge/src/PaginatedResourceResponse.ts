import { IParameters } from './Query/Parameters';
import { IResponse } from './IResponse';

export class PaginatedResourceResponse {
	constructor(
		private readonly data: any,
		private readonly total: number = 0,
		private readonly parameter: IParameters
	) {}

	public get meta(): Record<string, number> {
		return {
			current_page: this.current_page,
			per_page: this.per_page,
			total_count: this.total,
			total_items: this.data.length,
		};
	}

	public get links(): Record<string, string | null> {
		return {
			self: this._url(this.current_page),
			prev: this.prevPageUrl,
			next: this.nextPageUrl,
		};
	}

	public get current_page(): number {
		return Number(this.parameter.getPagingParameters().getPage());
	}

	public get per_page(): number {
		return Number(this.parameter.getPagingParameters().getSize());
	}

	private _url(page: number): string {
		const route = this.parameter.getRouteParameter();
		const paging = `page[number]=${page}&page[size]=${this.per_page}`;
		let query = this.query_string;
		query = query.length ? `${query}&${paging}` : `${paging}`;
		return `${route.getPath()}?${query}`;
	}

	private get nextPageUrl(): string | null {
		const total_pages = Math.ceil(this.total / this.per_page);
		if (this.current_page < total_pages) {
			return this._url(this.current_page + 1);
		}
		return null;
	}

	private get prevPageUrl(): string | null {
		if (this.current_page > 1) {
			return this._url(this.current_page - 1);
		}
		return null;
	}

	private get query_string(): string {
		return this.parameter.toQueryString([
			'paging',
			'route',
			'cache',
			'download',
		]);
	}

	toResponse(): IResponse {
		return {
			success: true,
			data: this.data,
			timestamp: new Date().toISOString(),
			meta: this.meta,
			links: this.links,
		};
	}
}
