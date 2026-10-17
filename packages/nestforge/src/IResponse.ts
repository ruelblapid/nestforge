export class Links {
	public self: string;
	public next: string;
	public prev: string;
	constructor({
		self,
		next,
		prev,
	}: {
		self: string;
		next: string;
		prev: string;
	}) {
		this.self = self;
		this.next = next;
		this.prev = prev;
	}
	static fromJson = (json: any): Links =>
		new Links({
			self: json.self,
			next: json.next,
			prev: json.prev,
		});
}

export class Meta {
	public current_page: number;
	public total_items: number;
	public total: number;
	public per_page: number;
	public path: string;
	constructor({
		current_page,
		total_items,
		total,
		per_page,
		path,
	}: {
		current_page: number;
		total_items: number;
		total: number;
		per_page: number;
		path: string;
	}) {
		this.current_page = current_page;
		this.total_items = total_items;
		this.total = total;
		this.per_page = per_page;
		this.path = path;
	}
	static fromJson = (json: any): Meta =>
		new Meta({
			current_page: json.current_page,
			total_items: json.total_items,
			total: json.total,
			per_page: json.per_page,
			path: json.path,
		});
}

export interface IResponse<T = any> {
	success: boolean;
	data?: T;
	timestamp?: string;
	message?: string;
	code?: number;
	meta?: Record<string, number>;
	links?: Record<string, string>;
}
