/**
 * Copyright (C) RBL Solution 2026
 * All Rights Reserved.
 *
 *
 * @author Ruel B. Lapid <ruelblapid@gmail.com>
 * @version 1.0.0
 * @since 1.0.0
 */

export const HTTP_STATUS = {
	BAD_REQUEST: 400,
};
export interface ApiExceptionOptions {
	/** Stable, machine-readable identifier (e.g. `CLAIM_NOT_FOUND`) that clients can branch on. */
	errorCode?: string;
	/** Extra fields that belong in the response (e.g. the offending state transition). */
	details?: Record<string, unknown>;
}

export default class ApiException extends Error {
	protected code: number = HTTP_STATUS.BAD_REQUEST;
	protected errorCode?: string;
	protected details?: Record<string, unknown>;

	constructor(message: string, code: number = HTTP_STATUS.BAD_REQUEST, options: ApiExceptionOptions = {}) {
		super(message);
		this.code = code;
		this.errorCode = options.errorCode;
		this.details = options.details;
	}

	getMessage() {
		return this.message;
	}

	getCode() {
		return this.code;
	}

	getErrorCode() {
		return this.errorCode;
	}

	getDetails() {
		return this.details;
	}
}
