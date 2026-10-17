import { Module } from '@nestjs/common';
import { AUTH_REPOSITORY, LOGIN_CODE_REPOSITORY, PROFILE_REPOSITORY, UNIT_OF_WORK } from '../domain/repositories';
import { PrismaService } from './prisma/prisma.service';
import { AuthRepository } from './repositories/auth.repository';
import { LoginCodeRepository } from './repositories/login-code.repository';
import { ProfileRepository } from './repositories/profile.repository';
import { PrismaUnitOfWork } from './unit-of-work';

// Schema changes go through migrations (`pnpm db:migrate:dev` in development, `pnpm db:migrate` to deploy);
// the app never alters the schema itself.
@Module({
	providers: [
		PrismaService,
		{ provide: AUTH_REPOSITORY, inject: [PrismaService], useFactory: (db: PrismaService) => new AuthRepository(db) },
		{ provide: PROFILE_REPOSITORY, inject: [PrismaService], useFactory: (db: PrismaService) => new ProfileRepository(db) },
		{ provide: LOGIN_CODE_REPOSITORY, inject: [PrismaService], useFactory: (db: PrismaService) => new LoginCodeRepository(db) },
		{ provide: UNIT_OF_WORK, inject: [PrismaService], useFactory: (db: PrismaService) => new PrismaUnitOfWork(db) },
	],
	exports: [PrismaService, AUTH_REPOSITORY, PROFILE_REPOSITORY, LOGIN_CODE_REPOSITORY, UNIT_OF_WORK],
})
export class DatabaseModule {}
