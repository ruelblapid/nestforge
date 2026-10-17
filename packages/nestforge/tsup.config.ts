import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm', 'cjs'],
	dts: true,
	sourcemap: true,
	clean: true,
	splitting: false,
	external: ['@nestjs/common', '@nestjs/core', 'rxjs', 'reflect-metadata'],
});
