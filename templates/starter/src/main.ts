import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from './api/swagger';
import { env } from './config/env';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	app.setGlobalPrefix('api', {
		exclude: [
			{ path: 'health', method: RequestMethod.GET },
			{ path: 'metrics', method: RequestMethod.GET },
		],
	});
	if (env.SWAGGER_ENABLED ?? env.NODE_ENV !== 'production') setupSwagger(app);
	app.enableShutdownHooks();
	await app.listen(env.PORT);
	console.log(`Listening on :${env.PORT}`);
}
bootstrap();
