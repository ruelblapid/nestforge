import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

// Accept a caller-supplied id (e.g. from a gateway) only if it is short and plain.
const SAFE_ID = /^[A-Za-z0-9._-]{1,64}$/;

/** Assigns a request id (echoed in `X-Request-Id`) and logs one line per finished request. */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
	private readonly logger = new Logger('HTTP');

	use(req: Request, res: Response, next: NextFunction) {
		const incoming = req.header(REQUEST_ID_HEADER);
		const requestId = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
		(req as Request & { id: string }).id = requestId;
		res.setHeader('X-Request-Id', requestId);

		const start = process.hrtime.bigint();
		res.on('finish', () => {
			const ms = Number(process.hrtime.bigint() - start) / 1e6;
			const status = res.statusCode;
			const user = (req as Request & { user?: { id: string } }).user;
			// Path only: query strings can carry filter values and shouldn't land in logs.
			const line = `${req.method} ${req.originalUrl.split('?')[0]} ${status} ${ms.toFixed(1)}ms id=${requestId}${user ? ` user=${user.id}` : ''}`;
			if (status >= 500) this.logger.error(line);
			else if (status >= 400) this.logger.warn(line);
			else this.logger.log(line);
		});
		next();
	}
}
