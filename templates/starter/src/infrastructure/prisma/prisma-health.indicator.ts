import { Injectable } from '@nestjs/common';
import { HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaHealthIndicator {
	constructor(
		private readonly prisma: PrismaService,
		private readonly indicators: HealthIndicatorService,
	) {}

	async pingCheck(key: string): Promise<HealthIndicatorResult> {
		const indicator = this.indicators.check(key);
		try {
			await this.prisma.$queryRaw`SELECT 1`;
			return indicator.up();
		} catch {
			return indicator.down({ message: 'database unreachable' });
		}
	}
}
