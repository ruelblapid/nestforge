import { IUnitOfWork, TransactionalRepositories, UniqueViolationError } from '../domain/repositories';
import { isUniqueViolation, PrismaService } from './prisma/prisma.service';
import { AuthRepository } from './repositories/auth.repository';
import { ProfileRepository } from './repositories/profile.repository';

export class PrismaUnitOfWork implements IUnitOfWork {
	constructor(private readonly prisma: PrismaService) {}

	async run<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T> {
		try {
			return await this.prisma.$transaction((tx) =>
				work({ auth: new AuthRepository(tx), profile: new ProfileRepository(tx) }),
			);
		} catch (e) {
			// Callers decide what a lost race means; they should not have to know the driver's error codes.
			if (isUniqueViolation(e)) throw new UniqueViolationError();
			throw e;
		}
	}
}
