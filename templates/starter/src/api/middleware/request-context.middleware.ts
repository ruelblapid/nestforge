import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { MetricsService } from '../../infrastructure/metrics/metrics.service';

export const REQUEST_ID_HEADER = 'x-request-id';

// Accept a caller-supplied id (e.g. from a gateway) only if it is short and plain.
const SAFE_ID = /^[A-Za-z0-9._-]{1,64}$/;

/** Assigns a request id (echoed in `X-Request-Id`), logs one line per finished request and records its duration. */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
	private readonly logger = new Logger('HTTP');

	constructor(private readonly metrics: MetricsService) {}

	use(req: Request, res: Response, next: NextFunction) {
		const incoming = req.header(REQUEST_ID_HEADER);
		const requestId = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
		(req as Request & { id: string }).id = requestId;
		res.setHeader('X-Request-Id', requestId);

		const start = process.hrtime.bigint();
		res.on('finish', () => {
			const ms = Number(process.hrtime.bigint() - start) / 1e6;
			const status = res.statusCode;
			// Route pattern (e.g. /api/profiles/me), never the raw URL: keeps label cardinality bounded.
			const route = (req.route?.path as string | undefined) ? `${req.baseUrl}${req.route.path}` : 'unmatched';
			this.metrics.observeRequest(req.method, route, status, ms / 1000);
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
