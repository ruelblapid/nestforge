import { OAuthProvider } from '../domain/auth-user';

export const OAUTH_CLIENTS = Symbol('OAUTH_CLIENTS');

export type OAuthClients = Record<OAuthProvider, IOAuthClient>;

/** The provider rejected the code, or could not be reached. Never shown to API callers verbatim. */
export class OAuthExchangeError extends Error {}
/** The caller asked for a client ID that is not configured. */
export class OAuthClientNotAllowedError extends Error {}

export interface AuthorizeParams {
	redirectUri: string;
	state: string;
	nonce: string;
	/** PKCE S256 challenge; ignored by providers that do not support PKCE. */
	codeChallenge: string;
}

export interface ExchangeParams {
	code: string;
	redirectUri?: string;
	/** PKCE verifier matching the challenge sent in the authorize request. */
	codeVerifier?: string;
	/** Defaults to the web client. Must be one of the configured client IDs. */
	clientId?: string;
}

/** Talks to one provider's authorize / token endpoints. ID tokens are verified separately. */
export interface IOAuthClient {
	/** Whether the server-side redirect flow can run (web client ID and secret/key configured). */
	readonly redirectFlowEnabled: boolean;
	/** Whether the provider honours PKCE; if not, the verifier is neither sent nor stored. */
	readonly supportsPkce: boolean;
	authorizeUrl(params: AuthorizeParams): string;
	/** Swaps an authorization code for the provider's ID token. */
	exchangeCode(params: ExchangeParams): Promise<string>;
}

export type FetchLike = (
	url: string,
	init: { method: 'POST'; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** POSTs a form to a token endpoint and returns its `id_token`. */
export async function postForIdToken(fetchFn: FetchLike, url: string, form: Record<string, string | undefined>) {
	const body = new URLSearchParams();
	for (const [key, value] of Object.entries(form)) if (value !== undefined) body.set(key, value);

	let response: Awaited<ReturnType<FetchLike>>;
	try {
		response = await fetchFn(url, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
			body: body.toString(),
		});
	} catch {
		throw new OAuthExchangeError('Could not reach the token endpoint');
	}

	const payload = (await response.json().catch(() => null)) as { id_token?: unknown; error?: unknown } | null;
	if (!response.ok || typeof payload?.id_token !== 'string') {
		throw new OAuthExchangeError(`Token endpoint rejected the code (${response.status}${payload?.error ? ` ${String(payload.error)}` : ''})`);
	}
	return payload.id_token;
}
