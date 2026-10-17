import { Module } from '@nestjs/common';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { env } from '../config/env';
import { AUTH_REPOSITORY, PROFILE_REPOSITORY, UNIT_OF_WORK } from '../domain/repositories';
import { AuthEntity } from './entities/auth.entity';
import { ProfileEntity } from './entities/profile.entity';
import { AuthRepository } from './repositories/auth.repository';
import { ProfileRepository } from './repositories/profile.repository';
import { TypeOrmUnitOfWork } from './unit-of-work';

const isProd = env.NODE_ENV === 'production';

@Module({
	imports: [
		TypeOrmModule.forRoot({
			type: 'postgres',
			url: env.DATABASE_URL,
			entities: [AuthEntity, ProfileEntity],
			// TODO: replace with migrations before production.
			synchronize: !isProd,
			logging: env.NODE_ENV === 'development',
			ssl: isProd ? { rejectUnauthorized: false } : false,
		}),
		TypeOrmModule.forFeature([AuthEntity, ProfileEntity]),
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
			provide: UNIT_OF_WORK,
			inject: [DataSource],
			useFactory: (ds: DataSource) => new TypeOrmUnitOfWork(ds),
		},
	],
	exports: [AUTH_REPOSITORY, PROFILE_REPOSITORY, UNIT_OF_WORK],
})
export class DatabaseModule {}
