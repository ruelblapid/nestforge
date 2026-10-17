import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaHealthIndicator } from '../../infrastructure/prisma/prisma-health.indicator';
import { Public } from '../security/security';

@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
	constructor(
		private readonly health: HealthCheckService,
		private readonly db: PrismaHealthIndicator,
	) {}

	@Get()
	@HealthCheck()
	check() {
		return this.health.check([() => this.db.pingCheck('database')]);
	}
}
