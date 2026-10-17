import { IParameters } from 'nestforge';
import { AuthUser, OAuthProvider } from '../auth-user';
import { Profile } from '../profile';

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');
export const PROFILE_REPOSITORY = Symbol('PROFILE_REPOSITORY');
export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');
export const LOGIN_CODE_REPOSITORY = Symbol('LOGIN_CODE_REPOSITORY');

export interface IAuthRepository {
	findById(id: string): Promise<AuthUser | null>;
	findByEmail(email: string): Promise<AuthUser | null>;
	findByProvider(provider: OAuthProvider, providerId: string): Promise<AuthUser | null>;
	/** Inserts or updates. */
	save(user: AuthUser): Promise<void>;
	softDelete(id: string): Promise<void>;
}

/** Short-lived, single-use codes that hand a finished browser sign-in back to the frontend. */
export interface ILoginCodeRepository {
	/** Stores a code (the caller supplies only its hash) for `authId`, valid for `ttlSeconds`. */
	issue(codeHash: string, authId: string, ttlSeconds: number): Promise<void>;
	/** Atomically deletes and returns the owner of an unexpired code, or null. A code works once. */
	consume(codeHash: string): Promise<string | null>;
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

/** A write lost a race against a unique constraint (e.g. two sign-ups with the same email at once). */
export class UniqueViolationError extends Error {
	constructor() {
		super('Unique constraint violated');
	}
}

/** Runs `work` in one DB transaction; rolls back if it throws.
 * Throws `UniqueViolationError` when a unique constraint rejects a write. */
export interface IUnitOfWork {
	run<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T>;
}
