import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env';
import { OAuthProvider } from '../domain/auth-user';
import { fail, ok, Result, unauthorizedError, validationError } from '../domain/errors';
import { ILoginCodeRepository, LOGIN_CODE_REPOSITORY } from '../domain/repositories';
import { AuthService, AuthTokens } from './auth.service';
import {
	OAUTH_CLIENTS,
	OAuthClientNotAllowedError,
	OAuthClients,
	ExchangeParams,
	OAuthExchangeError,
} from './oauth-client';

/** The state cookie is valid for the time a person needs to finish the provider's consent screen. */
export const STATE_TTL_SECONDS = 600;
export const STATE_COOKIE = 'oauth_state';
const LOGIN_CODE_TTL_SECONDS = 60;

interface StatePayload {
	/** provider */
	p: OAuthProvider;
	/** state sent to the provider */
	s: string;
	/** nonce expected in the ID token */
	n: string;
	/** PKCE verifier (providers that support it) */
	v?: string;
	/** expiry, epoch ms */
	e: number;
}

export interface StartRedirect {
	url: string;
	cookie: { name: string; value: string; maxAgeSeconds: number; sameSite: 'lax' | 'none'; secure: boolean };
}

export interface CallbackInput {
	code?: string;
	state?: string;
	error?: string;
	/** Apple's form_post `user` field: JSON with the name, sent only on the very first authorization. */
	user?: string;
}

export interface ClientCodeInput extends ExchangeParams {
	nonce?: string;
	firstName?: string;
	lastName?: string;
}

@Injectable()
export class OAuthService {
	constructor(
		private readonly auth: AuthService,
		private readonly jwt: JwtService,
		@Inject(OAUTH_CLIENTS) private readonly clients: OAuthClients,
		@Inject(LOGIN_CODE_REPOSITORY) private readonly loginCodes: ILoginCodeRepository,
	) {}

	/** Whether the browser redirect flow is fully configured for `provider`. */
	redirectEnabled(provider: OAuthProvider): boolean {
		return Boolean(env.OAUTH_PUBLIC_URL && env.WEB_LOGIN_REDIRECT_URL && this.clients[provider].redirectFlowEnabled);
	}

	callbackUrl(provider: OAuthProvider): string {
		return `${env.OAUTH_PUBLIC_URL!.replace(/\/+$/, '')}/api/auth/${provider}/callback`;
	}

	// ---- Flow 1: browser redirect (server holds the secret) -----------------------------------

	/** Builds the provider URL and the signed cookie that binds the redirect to this browser. */
	start(provider: OAuthProvider): Result<StartRedirect> {
		if (!this.redirectEnabled(provider)) return fail(validationError(`${provider} redirect sign-in is not enabled`));
		const client = this.clients[provider];

		const verifier = client.supportsPkce ? randomToken(32) : undefined;
		const payload: StatePayload = {
			p: provider,
			s: randomToken(24),
			n: randomToken(24),
			v: verifier,
			e: Date.now() + STATE_TTL_SECONDS * 1000,
		};
		const url = client.authorizeUrl({
			redirectUri: this.callbackUrl(provider),
			state: payload.s,
			nonce: payload.n,
			codeChallenge: verifier ? sha256Base64Url(verifier) : '',
		});
		return ok({
			url,
			cookie: {
				name: STATE_COOKIE,
				value: signState(payload),
				maxAgeSeconds: STATE_TTL_SECONDS,
				// Apple's callback is a cross-site POST, which a Lax cookie would not accompany.
				sameSite: provider === 'apple' ? 'none' : 'lax',
				secure: env.OAUTH_PUBLIC_URL!.startsWith('https:'),
			},
		});
	}

	/**
	 * Finishes the redirect flow. Always yields a URL for the browser: the web app's login page with
	 * `?code=` on success or `?error=` on any failure, so the user never lands on a raw JSON error.
	 */
	async complete(provider: OAuthProvider, input: CallbackInput, stateCookie: string | undefined): Promise<string> {
		const target = (params: Record<string, string>) => {
			const url = new URL(env.WEB_LOGIN_REDIRECT_URL!);
			for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
			return url.toString();
		};

		const state = verifyState(stateCookie);
		if (!state || state.p !== provider || !input.state || !safeEqual(state.s, input.state)) {
			return target({ error: 'invalid_state' });
		}
		if (input.error || !input.code) return target({ error: 'access_denied' });

		let idToken: string;
		try {
			idToken = await this.clients[provider].exchangeCode({
				code: input.code,
				redirectUri: this.callbackUrl(provider),
				codeVerifier: state.v,
			});
		} catch {
			return target({ error: 'exchange_failed' });
		}

		const names = parseAppleUser(input.user);
		const signedIn = await this.auth.signInWithProvider(provider, idToken, { nonce: state.n, ...names });
		if (signedIn.isLeft()) {
			const code = (signedIn.getLeft() as { code?: number }).code;
			return target({ error: code === 409 ? 'email_conflict' : 'sign_in_failed' });
		}

		const authId = this.jwt.decode<{ sub?: string }>(signedIn.getRight().accessToken)?.sub;
		if (!authId) return target({ error: 'sign_in_failed' });

		const code = randomToken(32);
		await this.loginCodes.issue(sha256Hex(code), authId, LOGIN_CODE_TTL_SECONDS);
		return target({ code });
	}

	/** Redeems the one-time code from the redirect for a normal token pair. Works once. */
	async redeemLoginCode(code: string): Promise<Result<AuthTokens>> {
		const authId = await this.loginCodes.consume(sha256Hex(code));
		if (!authId) return fail(unauthorizedError('Invalid or expired code'));
		return this.auth.startSession(authId);
	}

	// ---- Flow 2: client-side exchange (mobile / SPA hold the PKCE verifier) --------------------

	async signInWithCode(provider: OAuthProvider, input: ClientCodeInput): Promise<Result<AuthTokens>> {
		let idToken: string;
		try {
			idToken = await this.clients[provider].exchangeCode(input);
		} catch (e) {
			if (e instanceof OAuthClientNotAllowedError) return fail(validationError(e.message));
			if (e instanceof OAuthExchangeError) return fail(unauthorizedError(`Invalid ${provider} authorization code`));
			throw e;
		}
		return this.auth.signInWithProvider(provider, idToken, {
			nonce: input.nonce,
			firstName: input.firstName,
			lastName: input.lastName,
		});
	}
}

// ---- helpers ---------------------------------------------------------------------------------

const randomToken = (bytes: number) => randomBytes(bytes).toString('base64url');
const sha256Hex = (v: string) => createHash('sha256').update(v).digest('hex');
const sha256Base64Url = (v: string) => createHash('sha256').update(v).digest('base64url');

function safeEqual(a: string, b: string): boolean {
	const ab = Buffer.from(a);
	const bb = Buffer.from(b);
	return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Derived so the state cookie can never double as (or be forged from) a token signed with JWT_SECRET. */
const stateKey = () => createHmac('sha256', env.JWT_SECRET).update('oauth-state-v1').digest();

function signState(payload: StatePayload): string {
	const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
	const mac = createHmac('sha256', stateKey()).update(body).digest('base64url');
	return `${body}.${mac}`;
}

function verifyState(value: string | undefined): StatePayload | null {
	if (!value) return null;
	const [body, mac, extra] = value.split('.');
	if (!body || !mac || extra !== undefined) return null;
	const expected = createHmac('sha256', stateKey()).update(body).digest('base64url');
	if (!safeEqual(mac, expected)) return null;
	try {
		const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as StatePayload;
		return payload.e > Date.now() ? payload : null;
	} catch {
		return null;
	}
}

function parseAppleUser(raw: string | undefined): { firstName?: string; lastName?: string } {
	if (!raw) return {};
	try {
		const name = (JSON.parse(raw) as { name?: { firstName?: unknown; lastName?: unknown } }).name;
		return {
			firstName: typeof name?.firstName === 'string' ? name.firstName : undefined,
			lastName: typeof name?.lastName === 'string' ? name.lastName : undefined,
		};
	} catch {
		return {};
	}
}
