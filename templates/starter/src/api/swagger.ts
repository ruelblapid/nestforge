import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { z } from 'zod';

/** Request bodies are validated with Zod, so reuse the same schemas for the OpenAPI docs. */
export function bodySchema(schema: z.ZodType): Record<string, unknown> {
	return z.toJSONSchema(schema, { target: 'openapi-3.0', io: 'input' }) as Record<string, unknown>;
}

export function setupSwagger(app: INestApplication) {
	const config = new DocumentBuilder()
		.setTitle('nestforge starter')
		.setDescription('Auth, profiles and health. Authorize with an access token from /api/auth/login.')
		.setVersion('0.1.0')
		.addBearerAuth()
		.build();
	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs-json' });
}
