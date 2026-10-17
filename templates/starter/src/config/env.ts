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
