export interface IDatabase<TUserContext = unknown> {
	get(): Promise<IDatabase<TUserContext>>;
	close(): void;
	getName(): string;
	getInstance(): Promise<any>;
	getStorage(): any;
	setUserContext(context: TUserContext): void;
	getUserContext(): TUserContext;
	getAdminInstance(): Promise<any>;

	setTransactionContext(transaction: any): void;
	getTransactionContext(): any;
}

export interface IDatabaseManager<TUserContext = unknown> {
	getDatabase(): IDatabase<TUserContext>;
	getAuthDatabase(): IDatabase<TUserContext>;
	getStorage(): IDatabase<TUserContext>;
}
