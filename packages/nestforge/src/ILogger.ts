/**
 * Copyright (C) RBL Solution 2026
 * All Rights Reserved.
 */
export interface ILogger {
	debug(message: string, ...meta: any[]): void;
	error(message: string, ...meta: any[]): void;
	info(message: string, ...meta: any[]): void;
}
