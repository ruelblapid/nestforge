/**
 * Copyright (C) RBL Solution 2026
 * All Rights Reserved.
 *
 *
 * @author Ruel B. Lapid <ruelblapid@gmail.com>
 * @version 1.0.0
 * @since 1.0.0
 */
import ApiException, { HTTP_STATUS } from './ApiException';
export default class BadRequestException extends ApiException {
	constructor(message: string) {
		super(message, HTTP_STATUS.BAD_REQUEST);
	}
}
