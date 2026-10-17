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
export default class ApiException extends Error {
	protected code: number = HTTP_STATUS.BAD_REQUEST;

	constructor(message: string, code: number = HTTP_STATUS.BAD_REQUEST) {
		super(message);
		this.code = code;
	}

	getMessage() {
		return this.message;
	}

	getCode() {
		return this.code;
	}
}
