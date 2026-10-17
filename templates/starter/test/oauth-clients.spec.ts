import { exportPKCS8, generateKeyPair, jwtVerify } from 'jose';
import { describe, expect, it } from 'vitest';
import { FetchLike, OAuthClientNotAllowedError, OAuthExchangeError } from '../src/application/oauth-client';
import { AppleOAuthClient } from '../src/infrastructure/oauth/apple-oauth-client';
import { GoogleOAuthClient } from '../src/infrastructure/oauth/google-oauth-client';

function recorder(response: { ok?: boolean; status?: number; body?: unknown } = {}) {
	const calls: { url: string; form: URLSearchParams }[] = [];
	const fetch: FetchLike = async (url, init) => {
		calls.push({ url, form: new URLSearchParams(init.body) });
		return { ok: response.ok ?? true, status: response.status ?? 200, json: async () => response.body ?? { id_token: 'the-id-token' } };
	};
	return { calls, fetch };
}

const authorizeParams = { redirectUri: 'https://api.test/api/auth/google/callback', state: 'st', nonce: 'no', codeChallenge: 'ch' };

describe('GoogleOAuthClient', () => {
	it('builds an authorize URL with PKCE, state and nonce', () => {
		const client = new GoogleOAuthClient({ clientIds: ['web-id', 'ios-id'], clientSecret: 's' });
		const url = new URL(client.authorizeUrl(authorizeParams));
		expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
		expect(Object.fromEntries(url.searchParams)).toMatchObject({
			client_id: 'web-id',
			redirect_uri: authorizeParams.redirectUri,
			response_type: 'code',
			state: 'st',
			nonce: 'no',
			code_challenge: 'ch',
			code_challenge_method: 'S256',
		});
		expect(url.searchParams.get('scope')).toContain('openid');
	});

	it('is redirect-enabled only with a web client id and a secret', () => {
		expect(new GoogleOAuthClient({ clientIds: ['web'], clientSecret: 's' }).redirectFlowEnabled).toBe(true);
		expect(new GoogleOAuthClient({ clientIds: ['web'] }).redirectFlowEnabled).toBe(false);
		expect(new GoogleOAuthClient({ clientIds: [], clientSecret: 's' }).redirectFlowEnabled).toBe(false);
	});

	it('exchanges a code with the web client secret and the PKCE verifier', async () => {
		const { calls, fetch } = recorder();
		const client = new GoogleOAuthClient({ clientIds: ['web-id'], clientSecret: 'shh', fetch });
		const idToken = await client.exchangeCode({ code: 'c', redirectUri: 'https://x/cb', codeVerifier: 'v' });

		expect(idToken).toBe('the-id-token');
		expect(calls[0].url).toBe('https://oauth2.googleapis.com/token');
		expect(Object.fromEntries(calls[0].form)).toEqual({
			grant_type: 'authorization_code',
			code: 'c',
			client_id: 'web-id',
			redirect_uri: 'https://x/cb',
			code_verifier: 'v',
			client_secret: 'shh',
		});
	});

	it('does not send the web secret for another allowed client id', async () => {
		const { calls, fetch } = recorder();
		const client = new GoogleOAuthClient({ clientIds: ['web-id', 'ios-id'], clientSecret: 'shh', fetch });
		await client.exchangeCode({ code: 'c', clientId: 'ios-id', codeVerifier: 'v' });
		expect(calls[0].form.get('client_id')).toBe('ios-id');
		expect(calls[0].form.has('client_secret')).toBe(false);
	});

	it('rejects a client id that is not configured, without calling Google', async () => {
		const { calls, fetch } = recorder();
		const client = new GoogleOAuthClient({ clientIds: ['web-id'], clientSecret: 's', fetch });
		await expect(Promise.resolve().then(() => client.exchangeCode({ code: 'c', clientId: 'attacker' }))).rejects.toBeInstanceOf(
			OAuthClientNotAllowedError,
		);
		expect(calls).toHaveLength(0);
	});

	it('turns a rejected code or a network failure into OAuthExchangeError', async () => {
		const rejected = recorder({ ok: false, status: 400, body: { error: 'invalid_grant' } });
		await expect(new GoogleOAuthClient({ clientIds: ['w'], fetch: rejected.fetch }).exchangeCode({ code: 'c' })).rejects.toBeInstanceOf(
			OAuthExchangeError,
		);

		const noToken = recorder({ body: {} });
		await expect(new GoogleOAuthClient({ clientIds: ['w'], fetch: noToken.fetch }).exchangeCode({ code: 'c' })).rejects.toBeInstanceOf(
			OAuthExchangeError,
		);

		const down: FetchLike = async () => {
			throw new Error('ECONNREFUSED');
		};
		await expect(new GoogleOAuthClient({ clientIds: ['w'], fetch: down }).exchangeCode({ code: 'c' })).rejects.toBeInstanceOf(
			OAuthExchangeError,
		);
	});
});

describe('AppleOAuthClient', () => {
	async function keyedClient(fetch: FetchLike, clientIds = ['com.example.web', 'com.example.app']) {
		const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true });
		const client = new AppleOAuthClient({
			clientIds,
			teamId: 'TEAM123456',
			keyId: 'KEY1234567',
			privateKey: await exportPKCS8(privateKey),
			fetch,
		});
		return { client, publicKey };
	}

	it('builds a form_post authorize URL requesting name and email, without PKCE', async () => {
		const { client } = await keyedClient(recorder().fetch);
		const url = new URL(client.authorizeUrl({ ...authorizeParams, redirectUri: 'https://api.test/api/auth/apple/callback' }));
		expect(url.origin + url.pathname).toBe('https://appleid.apple.com/auth/authorize');
		expect(Object.fromEntries(url.searchParams)).toMatchObject({
			client_id: 'com.example.web',
			response_type: 'code',
			response_mode: 'form_post',
			scope: 'name email',
			state: 'st',
			nonce: 'no',
		});
		expect(url.searchParams.has('code_challenge')).toBe(false);
		expect(client.supportsPkce).toBe(false);
	});

	it('is redirect-enabled only when the team, key id and key are all set', async () => {
		expect((await keyedClient(recorder().fetch)).client.redirectFlowEnabled).toBe(true);
		expect(new AppleOAuthClient({ clientIds: ['web'], teamId: 't', keyId: 'k' }).redirectFlowEnabled).toBe(false);
	});

	it('sends a client secret JWT signed with the team key for the requested client id', async () => {
		const { calls, fetch } = recorder();
		const { client, publicKey } = await keyedClient(fetch);
		await client.exchangeCode({ code: 'c', redirectUri: 'https://x/cb', clientId: 'com.example.app' });

		expect(calls[0].url).toBe('https://appleid.apple.com/auth/token');
		expect(calls[0].form.get('client_id')).toBe('com.example.app');
		const { payload, protectedHeader } = await jwtVerify(calls[0].form.get('client_secret')!, publicKey, {
			issuer: 'TEAM123456',
			audience: 'https://appleid.apple.com',
			subject: 'com.example.app',
		});
		expect(protectedHeader).toMatchObject({ alg: 'ES256', kid: 'KEY1234567' });
		expect(payload.exp! - payload.iat!).toBeLessThanOrEqual(300);
	});

	it('rejects an unknown client id and reports an unusable key as an exchange failure', async () => {
		const { calls, fetch } = recorder();
		const { client } = await keyedClient(fetch);
		await expect(client.exchangeCode({ code: 'c', clientId: 'evil' })).rejects.toBeInstanceOf(OAuthClientNotAllowedError);

		const broken = new AppleOAuthClient({ clientIds: ['w'], teamId: 't', keyId: 'k', privateKey: 'not a pem', fetch });
		await expect(broken.exchangeCode({ code: 'c' })).rejects.toBeInstanceOf(OAuthExchangeError);
		expect(calls).toHaveLength(0);
	});
});
