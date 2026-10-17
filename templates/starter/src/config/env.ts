import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
	NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
	PORT: z.coerce.number().default(4000),
	DATABASE_URL: z.string().min(1),
	JWT_SECRET: z.string().min(32),
	JWT_REFRESH_SECRET: z.string().min(32),
	JWT_ACCESS_TTL_SECONDS: z.coerce.number().default(900),
	JWT_REFRESH_TTL_SECONDS: z.coerce.number().default(604800),
	// Comma-separated OAuth client IDs accepted as the token audience. Empty = provider disabled.
	GOOGLE_CLIENT_IDS: z.string().default(''),
	APPLE_CLIENT_IDS: z.string().default(''),
	// If set, GET /metrics requires `Authorization: Bearer <token>`. Empty = open (restrict it at the network level).
	METRICS_TOKEN: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(16).optional()),
	// TLS to Postgres. Defaults to on in production, off elsewhere.
	DATABASE_SSL: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['true', 'false']).optional()).transform((v) => (v === undefined ? undefined : v === 'true')),
	// Serve Swagger UI at /docs. Defaults to on outside production.
	SWAGGER_ENABLED: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['true', 'false']).optional()).transform((v) => (v === undefined ? undefined : v === 'true')),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
	const parsed = schema.safeParse(source);
	if (!parsed.success) {
		const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
		throw new Error(`Invalid environment:\n  ${details}`);
	}
	return parsed.data;
}

export const env = loadEnv();
