import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
	process.env.NODE_ENV = 'test';
	process.env.DATABASE_URL ??= 'postgresql://nestjs_user:nestjs_password@localhost:5432/nestjs_postgres';
	process.env.JWT_SECRET = 'a'.repeat(32);
	process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
	process.env.OAUTH_PUBLIC_URL = 'http://localhost:4000';
	process.env.WEB_LOGIN_REDIRECT_URL = 'http://localhost:3000/login/callback';
});

import { AppModule } from '../../src/app.module';
import { IDENTITY_VERIFIER, InvalidIdentityTokenError } from '../../src/application/identity-verifier';
import {
	AuthorizeParams,
	ExchangeParams,
	IOAuthClient,
	OAUTH_CLIENTS,
	OAuthClientNotAllowedError,
	OAuthExchangeError,
} from '../../src/application/oauth-client';

/**
 * Stands in for Google / Apple. Codes: `good-<n>` yields an ID token for subject `sub-<n>`;
 * anything else is rejected. The token embeds the nonce from the last authorize request so the
 * fake verifier can prove the nonce made the whole round trip.
 */
class FakeProvider implements IOAuthClient {
	readonly redirectFlowEnabled = true;
	lastAuthorize?: AuthorizeParams;
	exchanges: ExchangeParams[] = [];

	constructor(
		readonly name: string,
		readonly supportsPkce: boolean,
	) {}

	authorizeUrl(params: AuthorizeParams): string {
		this.lastAuthorize = params;
		const url = new URL(`https://${this.name}.test/authorize`);
		url.searchParams.set('state', params.state);
		url.searchParams.set('nonce', params.nonce);
		if (params.codeChallenge) url.searchParams.set('code_challenge', params.codeChallenge);
		return url.toString();
	}

	async exchangeCode(params: ExchangeParams): Promise<string> {
		this.exchanges.push(params);
		if (params.clientId === 'not-allowed') throw new OAuthClientNotAllowedError('Unknown client ID');
		const match = /^good-(\d+)$/.exec(params.code);
		if (!match) throw new OAuthExchangeError('rejected');
		return `${this.name}|sub-${match[1]}|user${match[1]}@${this.name}.test|${this.lastAuthorize?.nonce ?? ''}`;
	}
}

const google = new FakeProvider('google', true);
const apple = new FakeProvider('apple', false);

let app: INestApplication;
let db: DataSource;
const http = () => request(app.getHttpServer());

beforeAll(async () => {
	const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
		.overrideProvider(ThrottlerStorage)
		.useValue({ increment: async () => ({ totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }) })
		.overrideProvider(OAUTH_CLIENTS)
		.useValue({ google, apple })
		.overrideProvider(IDENTITY_VERIFIER)
		.useValue({
			async verify(provider: string, idToken: string, expectedNonce?: string) {
				const [name, sub, email, nonce] = idToken.split('|');
				if (name !== provider) throw new InvalidIdentityTokenError('wrong provider');
				// The client-side flow supplies its own nonce; the redirect flow must return the one we generated.
				if (expectedNonce !== undefined && expectedNonce !== nonce) throw new InvalidIdentityTokenError('Nonce mismatch');
				return { provider, subject: sub, email, emailVerified: true, givenName: 'Fake' };
			},
		})
		.compile();
	app = moduleRef.createNestApplication();
	app.setGlobalPrefix('api');
	app.useLogger(false);
	await app.init();
	db = app.get(DataSource);
});

beforeEach(async () => {
	await db.query('TRUNCATE TABLE login_codes, profiles, auths CASCADE');
	google.exchanges = [];
	apple.exchanges = [];
});

afterAll(async () => {
	await app?.close();
});

/** Runs GET /start and returns what the browser would hold: the cookie and the state sent to the provider. */
async function startFlow(provider: 'google' | 'apple') {
	const res = await http().get(`/api/auth/${provider}/start`);
	const location = new URL(res.headers.location);
	const cookie = (res.headers['set-cookie'] as unknown as string[] | undefined)?.[0];
	return { res, location, cookie: cookie?.split(';')[0] ?? '', setCookie: cookie ?? '', state: location.searchParams.get('state')! };
}

const webRedirect = (location: string) => new URL(location);

describe('redirect flow: start', () => {
	it('redirects to the provider with state, nonce and (for Google) a PKCE challenge, and sets a signed cookie', async () => {
		const { res, location, setCookie, state } = await startFlow('google');
		expect(res.status).toBe(302);
		expect(location.origin).toBe('https://google.test');
		expect(state.length).toBeGreaterThan(20);
		expect(location.searchParams.get('code_challenge')).toBeTruthy();
		expect(setCookie).toMatch(/^oauth_state=/);
		expect(setCookie).toMatch(/HttpOnly/i);
		expect(setCookie).toMatch(/Path=\/api\/auth/);
		expect(setCookie).toMatch(/SameSite=Lax/i);
		expect(google.lastAuthorize?.redirectUri).toBe('http://localhost:4000/api/auth/google/callback');
	});

	it('uses SameSite=None for Apple (cross-site form_post) and sends no PKCE challenge', async () => {
		const { location, setCookie } = await startFlow('apple');
		expect(setCookie).toMatch(/SameSite=None/i);
		expect(location.searchParams.has('code_challenge')).toBe(false);
	});

	it('uses a fresh state every time', async () => {
		expect((await startFlow('google')).state).not.toBe((await startFlow('google')).state);
	});

	it('rejects an unknown provider', async () => {
		expect((await http().get('/api/auth/github/start')).status).toBe(400);
	});
});

describe('redirect flow: callback and exchange', () => {
	it('signs in end to end and the one-time code works exactly once', async () => {
		const { cookie, state } = await startFlow('google');

		const cb = await http().get('/api/auth/google/callback').query({ code: 'good-1', state }).set('Cookie', cookie);
		expect(cb.status).toBe(302);
		const target = webRedirect(cb.headers.location);
		expect(target.origin + target.pathname).toBe('http://localhost:3000/login/callback');
		expect(target.searchParams.has('error')).toBe(false);
		const code = target.searchParams.get('code')!;
		expect(code.length).toBeGreaterThan(20);
		// The PKCE verifier is sent in the exchange, and the redirect URI matches the authorize request.
		expect(google.exchanges[0]).toMatchObject({ code: 'good-1', redirectUri: 'http://localhost:4000/api/auth/google/callback' });
		expect(google.exchanges[0].codeVerifier).toBeTruthy();
		// Browser state cookie is cleared.
		expect((cb.headers['set-cookie'] as unknown as string[]).join(';')).toMatch(/oauth_state=;/);

		const tokens = await http().post('/api/auth/exchange').send({ code });
		expect(tokens.status).toBe(200);
		expect(tokens.body.accessToken).toBeTruthy();
		const me = await http().get('/api/profiles/me').set('Authorization', `Bearer ${tokens.body.accessToken}`);
		expect(me.status).toBe(200);

		const again = await http().post('/api/auth/exchange').send({ code });
		expect(again.status).toBe(401);
	});

	it('refuses a callback without the cookie, with a wrong state, or with a tampered cookie', async () => {
		const { cookie, state } = await startFlow('google');
		const errorOf = (res: request.Response) => webRedirect(res.headers.location).searchParams.get('error');

		const noCookie = await http().get('/api/auth/google/callback').query({ code: 'good-2', state });
		expect(errorOf(noCookie)).toBe('invalid_state');

		const wrongState = await http().get('/api/auth/google/callback').query({ code: 'good-2', state: 'forged' }).set('Cookie', cookie);
		expect(errorOf(wrongState)).toBe('invalid_state');

		const tampered = await http()
			.get('/api/auth/google/callback')
			.query({ code: 'good-2', state })
			.set('Cookie', cookie.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')));
		expect(errorOf(tampered)).toBe('invalid_state');

		// A cookie minted for Apple cannot complete a Google callback.
		const other = await startFlow('apple');
		const crossProvider = await http().get('/api/auth/google/callback').query({ code: 'good-2', state: other.state }).set('Cookie', other.cookie);
		expect(errorOf(crossProvider)).toBe('invalid_state');

		expect(google.exchanges).toHaveLength(0);
		expect(await db.query('SELECT 1 FROM auths')).toHaveLength(0);
	});

	it('sends the browser back with an error when the user denies consent or the provider rejects the code', async () => {
		const first = await startFlow('google');
		const denied = await http().get('/api/auth/google/callback').query({ error: 'access_denied', state: first.state }).set('Cookie', first.cookie);
		expect(webRedirect(denied.headers.location).searchParams.get('error')).toBe('access_denied');

		const second = await startFlow('google');
		const rejected = await http().get('/api/auth/google/callback').query({ code: 'nope', state: second.state }).set('Cookie', second.cookie);
		expect(webRedirect(rejected.headers.location).searchParams.get('error')).toBe('exchange_failed');
	});

	it('rejects the nonce when the ID token does not carry the one we generated', async () => {
		const { cookie, state } = await startFlow('google');
		// Simulate a replayed token: the provider "issued" it for a different authorization request.
		const original = google.exchangeCode.bind(google);
		google.exchangeCode = async (p) => (await original(p)).replace(/\|[^|]*$/, '|someone-elses-nonce');
		try {
			const res = await http().get('/api/auth/google/callback').query({ code: 'good-3', state }).set('Cookie', cookie);
			expect(webRedirect(res.headers.location).searchParams.get('error')).toBe('sign_in_failed');
		} finally {
			google.exchangeCode = original;
		}
		expect(await db.query('SELECT 1 FROM auths')).toHaveLength(0);
	});

	it('handles Apple form_post and takes the name from the first-time `user` field', async () => {
		const { cookie, state } = await startFlow('apple');
		const cb = await http()
			.post('/api/auth/apple/callback')
			.type('form')
			.send({ code: 'good-4', state, user: JSON.stringify({ name: { firstName: 'Grace', lastName: 'Hopper' } }) })
			.set('Cookie', cookie);
		expect(cb.status).toBe(302);
		const code = webRedirect(cb.headers.location).searchParams.get('code')!;
		expect(apple.exchanges[0].codeVerifier).toBeUndefined();

		const tokens = await http().post('/api/auth/exchange').send({ code });
		const me = await http().get('/api/profiles/me').set('Authorization', `Bearer ${tokens.body.accessToken}`);
		expect(me.body).toMatchObject({ name: 'Grace', lastname: 'Hopper' });
	});

	it('signing in twice with the same provider account reuses the user', async () => {
		for (let i = 0; i < 2; i++) {
			const { cookie, state } = await startFlow('google');
			const cb = await http().get('/api/auth/google/callback').query({ code: 'good-5', state }).set('Cookie', cookie);
			const code = webRedirect(cb.headers.location).searchParams.get('code')!;
			expect((await http().post('/api/auth/exchange').send({ code })).status).toBe(200);
		}
		expect(await db.query('SELECT 1 FROM auths')).toHaveLength(1);
	});

	it('rejects an expired login code and unknown codes', async () => {
		const { cookie, state } = await startFlow('google');
		const cb = await http().get('/api/auth/google/callback').query({ code: 'good-6', state }).set('Cookie', cookie);
		const code = webRedirect(cb.headers.location).searchParams.get('code')!;
		await db.query(`UPDATE login_codes SET expires_at = now() - interval '1 second'`);

		expect((await http().post('/api/auth/exchange').send({ code })).status).toBe(401);
		expect((await http().post('/api/auth/exchange').send({ code: 'made-up' })).status).toBe(401);
		expect((await http().post('/api/auth/exchange').send({})).status).toBe(400);
	});

	it('does not store the login code in plain text', async () => {
		const { cookie, state } = await startFlow('google');
		const cb = await http().get('/api/auth/google/callback').query({ code: 'good-7', state }).set('Cookie', cookie);
		const code = webRedirect(cb.headers.location).searchParams.get('code')!;
		const rows = await db.query('SELECT code_hash FROM login_codes');
		expect(rows).toHaveLength(1);
		expect(rows[0].code_hash).not.toBe(code);
	});
});

describe('client-side exchange', () => {
	it('signs in with a code the client obtained itself and passes PKCE details through', async () => {
		const res = await http()
			.post('/api/auth/google/code')
			.send({ code: 'good-8', codeVerifier: 'v'.repeat(50), redirectUri: 'com.example.app:/oauth', clientId: 'ios-id' });
		expect(res.status).toBe(200);
		expect(res.body.accessToken).toBeTruthy();
		expect(google.exchanges[0]).toMatchObject({ redirectUri: 'com.example.app:/oauth', clientId: 'ios-id' });
	});

	it('uses the supplied nonce for ID token verification', async () => {
		// The fake provider embeds its last generated nonce; a client nonce that differs must fail.
		const res = await http().post('/api/auth/apple/code').send({ code: 'good-9', nonce: 'client-nonce' });
		expect(res.status).toBe(401);
	});

	it('takes the name Apple only gives the client on first authorization', async () => {
		const res = await http().post('/api/auth/apple/code').send({ code: 'good-10', firstName: 'Ada', lastName: 'Lovelace' });
		expect(res.status).toBe(200);
		const me = await http().get('/api/profiles/me').set('Authorization', `Bearer ${res.body.accessToken}`);
		expect(me.body).toMatchObject({ name: 'Ada', lastname: 'Lovelace' });
	});

	it('maps a rejected code to 401, a disallowed client to 400, and bad bodies to 400', async () => {
		expect((await http().post('/api/auth/google/code').send({ code: 'bad' })).status).toBe(401);
		expect((await http().post('/api/auth/google/code').send({ code: 'good-11', clientId: 'not-allowed' })).status).toBe(400);
		expect((await http().post('/api/auth/google/code').send({})).status).toBe(400);
		expect((await http().post('/api/auth/google/code').send({ code: 'x', extra: 1 })).status).toBe(400);
		expect((await http().post('/api/auth/github/code').send({ code: 'good-12' })).status).toBe(400);
	});
});
