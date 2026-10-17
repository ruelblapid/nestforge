/**
 * Copyright (C) RBL Solution 2026
 * All Rights Reserved.
 */
import { ITaggedCache } from './ITaggedCache';
export interface IStore {
	tags(...tags: string[]): ITaggedCache;
}
