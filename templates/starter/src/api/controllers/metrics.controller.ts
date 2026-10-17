import { Controller, Get, Header, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env';
import { MetricsService } from '../../infrastructure/metrics/metrics.service';
import { Public } from '../security/security';

/** Prometheus scrape endpoint. Set METRICS_TOKEN to require `Authorization: Bearer <token>`. */
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('metrics')
export class MetricsController {
	constructor(private readonly metrics: MetricsService) {}

	@Get()
	@Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
	async scrape(@Headers('authorization') authorization?: string) {
		if (env.METRICS_TOKEN && !tokenMatches(authorization, env.METRICS_TOKEN)) throw new UnauthorizedException();
		return this.metrics.render();
	}
}

function tokenMatches(header: string | undefined, expected: string): boolean {
	const given = Buffer.from(header?.startsWith('Bearer ') ? header.slice(7) : '');
	const want = Buffer.from(expected);
	return given.length === want.length && timingSafeEqual(given, want);
}
