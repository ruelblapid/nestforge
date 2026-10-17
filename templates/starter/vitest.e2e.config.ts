import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Needs a reachable Postgres (DATABASE_URL); run `docker compose up -d --wait` first.
export default defineConfig({
	test: {
		environment: 'node',
		include: ['test/e2e/**/*.e2e-spec.ts'],
		fileParallelism: false,
		testTimeout: 20_000,
		hookTimeout: 30_000,
	},
	plugins: [swc.vite({ module: { type: 'es6' } })],
});
