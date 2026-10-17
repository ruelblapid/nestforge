import 'reflect-metadata';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
	process.env.DATABASE_URL = 'postgres://x';
	process.env.JWT_SECRET = 'a'.repeat(32);
	process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
});

import { AuthService } from '../src/application/auth.service';
import { AuthUser } from '../src/domain/auth-user';
import { Profile } from '../src/domain/profile';
import { IIdentityVerifier, InvalidIdentityTokenError, VerifiedIdentity } from '../src/application/identity-verifier';
import { IAuthRepository, IProfileRepository, IUnitOfWork } from '../src/domain/repositories';
import { OAuthProvider } from '../src/domain/auth-user';

class FakeAuthRepo implements IAuthRepository {
	rows = new Map<string, AuthUser>();
	async findById(id: string) { return this.rows.get(id) ?? null; }
	async findByEmail(email: string) { return [...this.rows.values()].find((u) => u.email === email.toLowerCase()) ?? null; }
	async findByProvider(provider: OAuthProvider, id: string) { return [...this.rows.values()].find((u) => u.providerId(provider) === id) ?? null; }
	async save(u: AuthUser) { this.rows.set(u.id, u); }
	async softDelete(id: string) { this.rows.delete(id); }
}
class FakeProfileRepo implements Partial<IProfileRepository> {
	rows = new Map<string, Profile>();
	async save(p: Profile) { this.rows.set(p.id, p); }
}

class FakeVerifier implements IIdentityVerifier {
	next: VerifiedIdentity | Error = { provider: 'google', subject: 'g-1', email: 'g@example.com', emailVerified: true, givenName: 'Gina' };
	async verify(): Promise<VerifiedIdentity> {
		if (this.next instanceof Error) throw this.next;
		return this.next;
	}
}

function setup() {
	const auth = new FakeAuthRepo();
	const profiles = new FakeProfileRepo();
	const uow: IUnitOfWork = {
		// Snapshot-and-restore stands in for a rollback.
		async run(work) {
			const a = new Map(auth.rows);
			const p = new Map(profiles.rows);
			try {
				return await work({ auth, profile: profiles as unknown as IProfileRepository });
			} catch (e) {
				auth.rows = a;
				profiles.rows = p;
				throw e;
			}
		},
	};
	const verifier = new FakeVerifier();
	return { auth, profiles, verifier, service: new AuthService(auth, uow, new JwtService(), verifier) };
}

const input = { email: 'Bob@Example.com', password: 'Str0ng!Passw0rd#', name: 'Bob', lastname: 'Smith' };

describe('AuthService', () => {
	let ctx: ReturnType<typeof setup>;
	beforeEach(() => { ctx = setup(); });

	it('register creates user and profile together and returns tokens', async () => {
		const result = await ctx.service.register(input);
		expect(result.isRight()).toBe(true);
		expect(ctx.auth.rows.size).toBe(1);
		expect(ctx.profiles.rows.size).toBe(1);
		expect([...ctx.auth.rows.values()][0].email).toBe('bob@example.com');
	});

	it('register rejects a duplicate email with 409 and writes nothing extra', async () => {
		await ctx.service.register(input);
		const again = await ctx.service.register(input);
		expect(again.getLeft()).toMatchObject({ code: 409 });
		expect(ctx.auth.rows.size).toBe(1);
		expect(ctx.profiles.rows.size).toBe(1);
	});

	it('register with an invalid profile creates nothing', async () => {
		const result = await ctx.service.register({ ...input, name: 'B' });
		expect(result.isLeft()).toBe(true);
		expect(ctx.auth.rows.size).toBe(0);
	});

	it('login succeeds with the right password and fails with the wrong one', async () => {
		await ctx.service.register(input);
		expect((await ctx.service.login(input.email, input.password)).isRight()).toBe(true);
		expect((await ctx.service.login(input.email, 'nope')).getLeft()).toMatchObject({ code: 401 });
		expect((await ctx.service.login('ghost@example.com', 'nope')).getLeft()).toMatchObject({ code: 401 });
	});

	it('refresh rotates the token and the old one stops working', async () => {
		const first = (await ctx.service.register(input)).getRight();
		const second = (await ctx.service.refresh(first.refreshToken)).getRight();
		expect(second.refreshToken).not.toBe(first.refreshToken);
		expect((await ctx.service.refresh(first.refreshToken)).getLeft()).toMatchObject({ code: 401 });
		expect((await ctx.service.refresh(second.refreshToken)).isRight()).toBe(true);
	});

	it('logout revokes the refresh token', async () => {
		const tokens = (await ctx.service.register(input)).getRight();
		const userId = [...ctx.auth.rows.keys()][0];
		await ctx.service.logout(userId);
		expect((await ctx.service.refresh(tokens.refreshToken)).isLeft()).toBe(true);
	});

	it('changePassword checks the old password and revokes sessions', async () => {
		const tokens = (await ctx.service.register(input)).getRight();
		const userId = [...ctx.auth.rows.keys()][0];
		expect((await ctx.service.changePassword(userId, 'wrong', 'N3w!Passw0rd#xyz')).isLeft()).toBe(true);
		expect((await ctx.service.changePassword(userId, input.password, 'N3w!Passw0rd#xyz')).isRight()).toBe(true);
		expect((await ctx.service.refresh(tokens.refreshToken)).isLeft()).toBe(true);
		expect((await ctx.service.login(input.email, 'N3w!Passw0rd#xyz')).isRight()).toBe(true);
	});
});

describe('AuthService.signInWithProvider', () => {
	let ctx: ReturnType<typeof setup>;
	beforeEach(() => { ctx = setup(); });

	it('creates a user + profile on first sign-in, then reuses it', async () => {
		expect((await ctx.service.signInWithProvider('google', 't')).isRight()).toBe(true);
		expect(ctx.auth.rows.size).toBe(1);
		expect(ctx.profiles.rows.size).toBe(1);
		expect([...ctx.profiles.rows.values()][0].toPrimitives().name).toBe('Gina');

		expect((await ctx.service.signInWithProvider('google', 't')).isRight()).toBe(true);
		expect(ctx.auth.rows.size).toBe(1);
	});

	it('links to an existing account when the provider verified the email', async () => {
		await ctx.service.register({ ...input, email: 'g@example.com' });
		expect((await ctx.service.signInWithProvider('google', 't')).isRight()).toBe(true);
		expect(ctx.auth.rows.size).toBe(1);
		expect([...ctx.auth.rows.values()][0].providerId('google')).toBe('g-1');
	});

	it('refuses to link on an UNVERIFIED email (account-takeover guard)', async () => {
		await ctx.service.register({ ...input, email: 'g@example.com' });
		ctx.verifier.next = { provider: 'google', subject: 'g-1', email: 'g@example.com', emailVerified: false };
		expect((await ctx.service.signInWithProvider('google', 't')).getLeft()).toMatchObject({ code: 409 });
		expect([...ctx.auth.rows.values()][0].providerId('google')).toBeNull();
	});

	it('returns a generic 401 for a bad token without leaking verifier details', async () => {
		ctx.verifier.next = new InvalidIdentityTokenError('signature verification failed: secret detail');
		const left = (await ctx.service.signInWithProvider('google', 'bad')).getLeft();
		expect(left).toMatchObject({ code: 401, message: 'Invalid google token' });
	});

	it('requires an email to create a new account', async () => {
		ctx.verifier.next = { provider: 'apple', subject: 'a-1', emailVerified: false };
		expect((await ctx.service.signInWithProvider('apple', 't')).isLeft()).toBe(true);
		expect(ctx.auth.rows.size).toBe(0);
	});

	it('still signs in an Apple user who is already linked when the token has no email', async () => {
		ctx.verifier.next = { provider: 'apple', subject: 'a-1', email: 'a@example.com', emailVerified: true };
		await ctx.service.signInWithProvider('apple', 't');
		ctx.verifier.next = { provider: 'apple', subject: 'a-1', emailVerified: false };
		expect((await ctx.service.signInWithProvider('apple', 't')).isRight()).toBe(true);
	});
});
