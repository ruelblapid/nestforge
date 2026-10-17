import { Module } from '@nestjs/common';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { env } from '../config/env';
import { AUTH_REPOSITORY, LOGIN_CODE_REPOSITORY, PROFILE_REPOSITORY, UNIT_OF_WORK } from '../domain/repositories';
import { AuthEntity } from './entities/auth.entity';
import { LoginCodeEntity } from './entities/login-code.entity';
import { ProfileEntity } from './entities/profile.entity';
import { dataSource } from './data-source';
import { AuthRepository } from './repositories/auth.repository';
import { LoginCodeRepository } from './repositories/login-code.repository';
import { ProfileRepository } from './repositories/profile.repository';
import { TypeOrmUnitOfWork } from './unit-of-work';

const isProd = env.NODE_ENV === 'production';
const isTest = env.NODE_ENV === 'test';

@Module({
	imports: [
		TypeOrmModule.forRoot({
			...dataSource.options,
			// Schema changes go through migrations; auto-apply only outside production.
			synchronize: false,
			// Tests run against a database migrated beforehand (`pnpm migration:run`); vitest can't load the .ts migrations.
			migrations: isTest ? [] : dataSource.options.migrations,
			migrationsRun: !isProd && !isTest,
		}),
		TypeOrmModule.forFeature([AuthEntity, ProfileEntity, LoginCodeEntity]),
	],
	providers: [
		{
			provide: AUTH_REPOSITORY,
			inject: [getRepositoryToken(AuthEntity)],
			useFactory: (repo: Repository<AuthEntity>) => new AuthRepository(repo),
		},
		{
			provide: PROFILE_REPOSITORY,
			inject: [getRepositoryToken(ProfileEntity)],
			useFactory: (repo: Repository<ProfileEntity>) => new ProfileRepository(repo),
		},
		{
			provide: LOGIN_CODE_REPOSITORY,
			inject: [getRepositoryToken(LoginCodeEntity)],
			useFactory: (repo: Repository<LoginCodeEntity>) => new LoginCodeRepository(repo),
		},
		{
			provide: UNIT_OF_WORK,
			inject: [DataSource],
			useFactory: (ds: DataSource) => new TypeOrmUnitOfWork(ds),
		},
	],
	exports: [AUTH_REPOSITORY, PROFILE_REPOSITORY, LOGIN_CODE_REPOSITORY, UNIT_OF_WORK],
})
export class DatabaseModule {}
