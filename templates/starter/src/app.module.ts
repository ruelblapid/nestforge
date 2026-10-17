import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ApiExceptionFilter, EitherInterceptor } from 'nestforge';
import { AuthController } from './api/controllers/auth.controller';
import { HealthController } from './api/controllers/health.controller';
import { MetricsController } from './api/controllers/metrics.controller';
import { ProfileController } from './api/controllers/profile.controller';
import { RequestContextMiddleware } from './api/middleware/request-context.middleware';
import { JwtAuthGuard, JwtStrategy, RolesGuard } from './api/security/security';
import { AuthService } from './application/auth.service';
import { IDENTITY_VERIFIER } from './application/identity-verifier';
import { env } from './config/env';
import { ProfileService } from './application/profile.service';
import { DatabaseModule } from './infrastructure/database.module';
import { MetricsService } from './infrastructure/metrics/metrics.service';
import { JoseIdentityVerifier, parseClientIds } from './infrastructure/jose-identity-verifier';

@Module({
	imports: [
		ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
		PassportModule,
		JwtModule.register({}), // secrets are passed per call in AuthService
		TerminusModule,
		DatabaseModule,
	],
	controllers: [AuthController, ProfileController, HealthController, MetricsController],
	providers: [
		AuthService,
		ProfileService,
		MetricsService,
		JwtStrategy,
		{
			provide: IDENTITY_VERIFIER,
			useFactory: () =>
				new JoseIdentityVerifier({
					googleAudiences: parseClientIds(env.GOOGLE_CLIENT_IDS),
					appleAudiences: parseClientIds(env.APPLE_CLIENT_IDS),
				}),
		},
		{ provide: APP_FILTER, useClass: ApiExceptionFilter },
		{ provide: APP_INTERCEPTOR, useClass: EitherInterceptor },
		// Guard order: throttle -> authenticate -> authorize.
		{ provide: APP_GUARD, useClass: ThrottlerGuard },
		{ provide: APP_GUARD, useClass: JwtAuthGuard },
		{ provide: APP_GUARD, useClass: RolesGuard },
	],
})
export class AppModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		// Probes and scrapes are frequent and uninteresting; keep them out of the request log and metrics.
		consumer
			.apply(RequestContextMiddleware)
			.exclude(
				{ path: 'health', method: RequestMethod.GET },
				{ path: 'metrics', method: RequestMethod.GET },
			)
			.forRoutes('*');
	}
}
