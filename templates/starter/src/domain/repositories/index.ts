import { IParameters } from 'nestforge';
import { AuthUser, OAuthProvider } from '../auth-user';
import { Profile } from '../profile';

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');
export const PROFILE_REPOSITORY = Symbol('PROFILE_REPOSITORY');
export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');

export interface IAuthRepository {
	findById(id: string): Promise<AuthUser | null>;
	findByEmail(email: string): Promise<AuthUser | null>;
	findByProvider(provider: OAuthProvider, providerId: string): Promise<AuthUser | null>;
	/** Inserts or updates. */
	save(user: AuthUser): Promise<void>;
	softDelete(id: string): Promise<void>;
}

export interface Page<T> {
	items: T[];
	total: number;
	page: number;
	size: number;
}

export interface IProfileRepository {
	findById(id: string): Promise<Profile | null>;
	findByAuthId(authId: string): Promise<Profile | null>;
	list(parameters: IParameters): Promise<Page<Profile>>;
	/** Inserts or updates. */
	save(profile: Profile): Promise<void>;
	softDelete(id: string): Promise<void>;
}

export interface TransactionalRepositories {
	auth: IAuthRepository;
	profile: IProfileRepository;
}

/** Runs `work` in one DB transaction; rolls back if it throws. */
export interface IUnitOfWork {
	run<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T>;
}
