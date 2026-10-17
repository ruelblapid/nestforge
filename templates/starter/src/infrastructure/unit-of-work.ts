import { DataSource } from 'typeorm';
import { IUnitOfWork, TransactionalRepositories } from '../domain/repositories';
import { AuthEntity } from './entities/auth.entity';
import { ProfileEntity } from './entities/profile.entity';
import { AuthRepository } from './repositories/auth.repository';
import { ProfileRepository } from './repositories/profile.repository';

export class TypeOrmUnitOfWork implements IUnitOfWork {
	constructor(private readonly dataSource: DataSource) {}

	run<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T> {
		return this.dataSource.transaction((manager) =>
			work({
				auth: new AuthRepository(manager.getRepository(AuthEntity)),
				profile: new ProfileRepository(manager.getRepository(ProfileEntity)),
			}),
		);
	}
}
