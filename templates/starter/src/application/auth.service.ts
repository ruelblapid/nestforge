import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { env } from '../config/env';
import { AuthUser, OAuthProvider } from '../domain/auth-user';
import { conflictError, fail, ok, Result, unauthorizedError, validationError } from '../domain/errors';
import { Profile } from '../domain/profile';
import {
	IDENTITY_VERIFIER,
	IdentityProviderDisabledError,
	IIdentityVerifier,
	VerifiedIdentity,
} from './identity-verifier';
import { AUTH_REPOSITORY, IAuthRepository, IUnitOfWork, UNIT_OF_WORK } from '../domain/repositories';

export interface RegisterInput {
	email: string;
	password: string;
	name: string;
	lastname?: string;
	age?: number;
}

export interface AuthTokens {
	accessToken: string;
	refreshToken: string;
	expiresIn: number;
}

export interface AccessTokenPayload {
	sub: string;
	email: string;
	roles: string[];
}

const BCRYPT_ROUNDS = 10;
/** Compared against when the email is unknown, so login time doesn't reveal which emails exist. */
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);
const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class AuthService {
	constructor(
		@Inject(AUTH_REPOSITORY) private readonly users: IAuthRepository,
		@Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
		private readonly jwt: JwtService,
		@Inject(IDENTITY_VERIFIER) private readonly identities: IIdentityVerifier,
	) {}

	/** Creates the auth user and profile in ONE transaction, then returns tokens. No polling, no sagas. */
	async register(input: RegisterInput): Promise<Result<AuthTokens>> {
		const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

		const created = AuthUser.create({ email: input.email, passwordHash });
		if (created.isLeft()) return fail(created.getLeft());
		const user = created.getRight();

		const profileResult = Profile.create({
			authId: user.id,
			name: input.name,
			lastname: input.lastname,
			age: input.age,
		});
		if (profileResult.isLeft()) return fail(profileResult.getLeft());
		const profile = profileResult.getRight();

		const tokens = await this.issueTokens(user);
		user.recordLogin(hashToken(tokens.refreshToken));

		const stored = await this.createAccount(user, profile);
		return stored.isLeft() ? fail(stored.getLeft()) : ok(tokens);
	}

	/** Sign in (or sign up) with a Google / Apple ID token. */
	async signInWithProvider(
		provider: OAuthProvider,
		idToken: string,
		hints: { nonce?: string; firstName?: string; lastName?: string } = {},
	): Promise<Result<AuthTokens>> {
		let identity: VerifiedIdentity;
		try {
			identity = await this.identities.verify(provider, idToken, hints.nonce);
		} catch (e) {
			if (e instanceof IdentityProviderDisabledError) return fail(validationError(e.message));
			return fail(unauthorizedError(`Invalid ${provider} token`)); // don't leak verifier details
		}

		// 1. Already linked -> plain login.
		let user = await this.users.findByProvider(provider, identity.subject);

		// 2. Same email already registered -> link, but only if the provider vouches for the email.
		//    Linking on an unverified email would let anyone take over an account.
		if (!user && identity.email) {
			const existing = await this.users.findByEmail(identity.email);
			if (existing) {
				if (!identity.emailVerified) {
					return fail(conflictError('An account with this email exists; the provider has not verified the email.'));
				}
				existing.linkProvider(provider, identity.subject);
				user = existing;
			}
		}

		if (user) {
			const tokens = await this.issueTokens(user);
			user.recordLogin(hashToken(tokens.refreshToken));
			await this.users.save(user);
			return ok(tokens);
		}

		// 3. New account.
		if (!identity.email) return fail(validationError('The provider did not return an email address.'));
		const created = AuthUser.createExternal({ email: identity.email, provider, providerId: identity.subject });
		if (created.isLeft()) return fail(created.getLeft());
		const newUser = created.getRight();

		const profileResult = Profile.create({
			authId: newUser.id,
			name: displayName(hints.firstName ?? identity.givenName, identity.email),
			lastname: cleanOptional(hints.lastName ?? identity.familyName),
		});
		if (profileResult.isLeft()) return fail(profileResult.getLeft());

		const tokens = await this.issueTokens(newUser);
		newUser.recordLogin(hashToken(tokens.refreshToken));
		const stored = await this.createAccount(newUser, profileResult.getRight());
		return stored.isLeft() ? fail(stored.getLeft()) : ok(tokens);
	}

	async login(email: string, password: string): Promise<Result<AuthTokens>> {
		const user = await this.users.findByEmail(email);
		const matches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
		if (!user || !user.passwordHash || !matches) return fail(unauthorizedError());

		const tokens = await this.issueTokens(user);
		user.recordLogin(hashToken(tokens.refreshToken));
		await this.users.save(user);
		return ok(tokens);
	}

	async refresh(refreshToken: string): Promise<Result<AuthTokens>> {
		let payload: AccessTokenPayload;
		try {
			payload = await this.jwt.verifyAsync<AccessTokenPayload>(refreshToken, { secret: env.JWT_REFRESH_SECRET });
		} catch {
			return fail(unauthorizedError('Invalid refresh token'));
		}

		const user = await this.users.findById(payload.sub);
		if (!user?.refreshTokenHash || !safeEqual(user.refreshTokenHash, hashToken(refreshToken))) {
			return fail(unauthorizedError('Invalid refresh token'));
		}

		const tokens = await this.issueTokens(user);
		user.rotateRefreshToken(hashToken(tokens.refreshToken));
		await this.users.save(user);
		return ok(tokens);
	}

	/** Starts a fresh session for an already-authenticated user (e.g. after redeeming a login code). */
	async startSession(userId: string): Promise<Result<AuthTokens>> {
		const user = await this.users.findById(userId);
		if (!user) return fail(unauthorizedError());
		const tokens = await this.issueTokens(user);
		user.recordLogin(hashToken(tokens.refreshToken));
		await this.users.save(user);
		return ok(tokens);
	}

	async logout(userId: string): Promise<Result<null>> {
		const user = await this.users.findById(userId);
		if (user) {
			user.revokeRefreshToken();
			await this.users.save(user);
		}
		return ok(null);
	}

	async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<Result<null>> {
		const user = await this.users.findById(userId);
		if (!user?.passwordHash || !(await bcrypt.compare(oldPassword, user.passwordHash))) {
			return fail(unauthorizedError('Current password is incorrect'));
		}
		if (oldPassword === newPassword) return fail(validationError('New password must be different from old password'));

		user.changePasswordHash(await bcrypt.hash(newPassword, BCRYPT_ROUNDS));
		await this.users.save(user);
		return ok(null);
	}

	/** Inserts user + profile in ONE transaction; maps duplicate-email races to 409. */
	private async createAccount(user: AuthUser, profile: Profile): Promise<Result<null>> {
		try {
			const conflict = await this.uow.run(async ({ auth, profile: profiles }) => {
				if (await auth.findByEmail(user.email)) return conflictError('An account with this email already exists.');
				await auth.save(user);
				await profiles.save(profile);
				return null;
			});
			return conflict ? fail(conflict) : ok(null);
		} catch (e) {
			// Two concurrent sign-ups can both pass the check above; the unique index decides.
			if ((e as { code?: string })?.code === PG_UNIQUE_VIOLATION) {
				return fail(conflictError('An account with this email already exists.'));
			}
			throw e;
		}
	}

	private async issueTokens(user: AuthUser): Promise<AuthTokens> {
		const payload: AccessTokenPayload = { sub: user.id, email: user.email, roles: user.roles };
		const [accessToken, refreshToken] = await Promise.all([
			this.jwt.signAsync(payload, { secret: env.JWT_SECRET, expiresIn: env.JWT_ACCESS_TTL_SECONDS }),
			// jwtid makes every refresh token unique even when issued in the same second.
			this.jwt.signAsync(payload, {
				secret: env.JWT_REFRESH_SECRET,
				expiresIn: env.JWT_REFRESH_TTL_SECONDS,
				jwtid: randomUUID(),
			}),
		]);
		return { accessToken, refreshToken, expiresIn: env.JWT_ACCESS_TTL_SECONDS };
	}
}

/**
 * Refresh tokens are stored as SHA-256, not bcrypt: bcrypt only reads the first 72 bytes, and
 * the first 72 bytes of a JWT (header + start of payload) are identical for every token of a user.
 */
function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
	const ab = Buffer.from(a);
	const bb = Buffer.from(b);
	return ab.length === bb.length && timingSafeEqual(ab, bb);
}

const cleanOptional = (v?: string) => (v && v.trim().length >= 2 ? v.trim() : undefined);

/** Profile names need 2+ chars; fall back to the email's local part. */
function displayName(given: string | undefined, email: string): string {
	const name = given?.trim() || email.split('@')[0];
	return name.length >= 2 ? name.slice(0, 100) : 'User';
}
