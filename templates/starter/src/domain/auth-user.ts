import { v4 as uuid } from 'uuid';
import { fail, ok, Result, validationError } from './errors';
import { Role } from './role';

export interface AuthUserProps {
	id: string;
	email: string;
	passwordHash: string | null;
	roles: Role[];
	refreshTokenHash: string | null;
	lastLoginAt: Date | null;
	googleId: string | null;
	appleId: string | null;
}

export type OAuthProvider = 'google' | 'apple';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthUser {
	private constructor(private props: AuthUserProps) {}

	/** Creates a new user. The password must already be hashed. */
	static create(input: { email: string; passwordHash: string; roles?: Role[] }): Result<AuthUser> {
		const email = input.email.trim().toLowerCase();
		if (!EMAIL.test(email)) return fail(validationError('Invalid email format'));
		return ok(
			new AuthUser({
				id: `auth-${uuid()}`,
				email,
				passwordHash: input.passwordHash,
				roles: input.roles?.length ? input.roles : [Role.USER],
				refreshTokenHash: null,
				lastLoginAt: null,
				googleId: null,
				appleId: null,
			}),
		);
	}

	/** Creates a user that signed up through an external provider (no password). */
	static createExternal(input: { email: string; provider: OAuthProvider; providerId: string }): Result<AuthUser> {
		const email = input.email.trim().toLowerCase();
		if (!EMAIL.test(email)) return fail(validationError('Invalid email format'));
		return ok(
			new AuthUser({
				id: `auth-${uuid()}`,
				email,
				passwordHash: null,
				roles: [Role.USER],
				refreshTokenHash: null,
				lastLoginAt: null,
				googleId: input.provider === 'google' ? input.providerId : null,
				appleId: input.provider === 'apple' ? input.providerId : null,
			}),
		);
	}

	/** Rehydrates from persistence (no validation). */
	static restore(props: AuthUserProps): AuthUser {
		return new AuthUser(props);
	}

	get id() {
		return this.props.id;
	}
	get email() {
		return this.props.email;
	}
	get passwordHash() {
		return this.props.passwordHash;
	}
	get roles() {
		return this.props.roles;
	}
	get refreshTokenHash() {
		return this.props.refreshTokenHash;
	}

	providerId(provider: OAuthProvider) {
		return provider === 'google' ? this.props.googleId : this.props.appleId;
	}

	linkProvider(provider: OAuthProvider, providerId: string) {
		if (provider === 'google') this.props.googleId = providerId;
		else this.props.appleId = providerId;
	}

	hasRole(role: Role) {
		return this.props.roles.includes(role);
	}

	recordLogin(refreshTokenHash: string, at = new Date()) {
		this.props.refreshTokenHash = refreshTokenHash;
		this.props.lastLoginAt = at;
	}
	rotateRefreshToken(refreshTokenHash: string) {
		this.props.refreshTokenHash = refreshTokenHash;
	}
	revokeRefreshToken() {
		this.props.refreshTokenHash = null;
	}
	changePasswordHash(passwordHash: string) {
		this.props.passwordHash = passwordHash;
		this.props.refreshTokenHash = null; // force re-login everywhere
	}

	toPrimitives(): AuthUserProps {
		return { ...this.props };
	}
}
