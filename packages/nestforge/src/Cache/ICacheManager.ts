/**
 * Copyright (C) RBL Solution 2026
 * All Rights Reserved.
 */
import { ICacheRepository } from './ICacheRepository';

export interface ICacheManager {
	repository(driver?: string): ICacheRepository;

	destroy(): void;
}
