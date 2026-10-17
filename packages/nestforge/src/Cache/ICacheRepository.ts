import { IStore } from './IStore';
/**
 * Copyright (C) RBL Solution 2026
 * All Rights Reserved.
 */
export interface ICacheRepository extends IStore {
	forever(key: string, value: unknown): Promise<void>;
	remember(
		key: string,
		expireAt: number,
		callback?: () => Promise<unknown> | unknown
	): Promise<unknown>;
	set(key: string, value: unknown, expireAt?: number): Promise<void>;
	get(key: string): Promise<unknown | undefined>;
	forget(key: string): Promise<void>;
	flush(): Promise<void>;
	destroy(): Promise<void>;
	keys(name: string): Promise<unknown | undefined>;
}

export interface CacheItem {
	_id?: string;
	key: string;
	value: unknown;
	expireAt?: number;
}
