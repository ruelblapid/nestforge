import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../../config/env';
import { Prisma, PrismaClient } from '../../../generated/prisma';

/** What a repository needs: the root client, or the client handed to a `$transaction` callback. */
export type DbClient = Prisma.TransactionClient;

const isProd = env.NODE_ENV === 'production';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
	constructor() {
		super({
			adapter: new PrismaPg({
				connectionString: env.DATABASE_URL,
				ssl: (env.DATABASE_SSL ?? isProd) ? { rejectUnauthorized: false } : false,
			}),
			log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
		});
	}

	async onModuleInit(): Promise<void> {
		await this.$connect();
	}

	async onModuleDestroy(): Promise<void> {
		await this.$disconnect();
	}
}

/** Prisma reports a violated unique index as P2002 (the driver adapter maps Postgres 23505 to it). */
export function isUniqueViolation(error: unknown): boolean {
	return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002';
}
