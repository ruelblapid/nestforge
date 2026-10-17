import {
	AuthorizeParams,
	ExchangeParams,
	FetchLike,
	IOAuthClient,
	OAuthClientNotAllowedError,
	postForIdToken,
} from '../../application/oauth-client';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export interface GoogleOAuthOptions {
	/** Accepted client IDs; the first is the web client used for the redirect flow. */
	clientIds: string[];
	/** Secret of the web client. Native/SPA clients using PKCE alone have none. */
	clientSecret?: string;
	fetch?: FetchLike;
}

export class GoogleOAuthClient implements IOAuthClient {
	readonly supportsPkce = true;
	private readonly fetchFn: FetchLike;

	constructor(private readonly options: GoogleOAuthOptions) {
		this.fetchFn = options.fetch ?? (globalThis.fetch as unknown as FetchLike);
	}

	private get webClientId(): string | undefined {
		return this.options.clientIds[0];
	}

	get redirectFlowEnabled(): boolean {
		return Boolean(this.webClientId && this.options.clientSecret);
	}

	authorizeUrl(params: AuthorizeParams): string {
		const url = new URL(AUTHORIZE_URL);
		url.search = new URLSearchParams({
			client_id: this.webClientId ?? '',
			redirect_uri: params.redirectUri,
			response_type: 'code',
			scope: 'openid email profile',
			state: params.state,
			nonce: params.nonce,
			code_challenge: params.codeChallenge,
			code_challenge_method: 'S256',
		}).toString();
		return url.toString();
	}

	exchangeCode(params: ExchangeParams): Promise<string> {
		const clientId = params.clientId ?? this.webClientId;
		if (!clientId || !this.options.clientIds.includes(clientId)) {
			throw new OAuthClientNotAllowedError('Unknown Google client ID');
		}
		return postForIdToken(this.fetchFn, TOKEN_URL, {
			grant_type: 'authorization_code',
			code: params.code,
			client_id: clientId,
			redirect_uri: params.redirectUri,
			code_verifier: params.codeVerifier,
			// Only the web client has a secret; sending it for another client ID would be rejected.
			client_secret: clientId === this.webClientId ? this.options.clientSecret : undefined,
		});
	}
}
