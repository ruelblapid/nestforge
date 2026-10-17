import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from '../config/env';
import { AuthEntity } from './entities/auth.entity';
import { LoginCodeEntity } from './entities/login-code.entity';
import { ProfileEntity } from './entities/profile.entity';

const isProd = env.NODE_ENV === 'production';

/** Shared by the app and the TypeORM CLI (`pnpm migration:*`). */
export const dataSource = new DataSource({
	type: 'postgres',
	url: env.DATABASE_URL,
	entities: [AuthEntity, ProfileEntity, LoginCodeEntity],
	migrations: [__dirname + '/migrations/*.{ts,js}'],
	logging: env.NODE_ENV === 'development',
	ssl: (env.DATABASE_SSL ?? isProd) ? { rejectUnauthorized: false } : false,
});

