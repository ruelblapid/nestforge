import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
	schema: 'prisma/schema.prisma',
	datasource: {
		url: process.env.DATABASE_URL ?? '',
		// Only used by `prisma migrate dev` / `migrate diff`; falls back to a scratch database next to the main one.
		shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
	},
});
