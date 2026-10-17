import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Histogram, Registry } from 'prom-client';

/** Own registry (not the global one) so several app instances in one process, e.g. tests, don't collide. */
@Injectable()
export class MetricsService {
	readonly registry = new Registry();

	private readonly httpDuration = new Histogram({
		name: 'http_request_duration_seconds',
		help: 'HTTP request duration in seconds',
		labelNames: ['method', 'route', 'status_code'] as const,
		buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
		registers: [this.registry],
	});

	constructor() {
		collectDefaultMetrics({ register: this.registry });
	}

	observeRequest(method: string, route: string, statusCode: number, seconds: number) {
		this.httpDuration.observe({ method, route, status_code: String(statusCode) }, seconds);
	}

	render(): Promise<string> {
		return this.registry.metrics();
	}
}
