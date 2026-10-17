/**
 * Copyright (C) RBL Solution 2026
 * All Rights Reserved.
 */
import { CommandResponse } from './UseCase';
export interface IMailer {
	send(
		from: string,
		to: string,
		subject: string,
		content: string,
		cc: string
	): Promise<CommandResponse>;
}
