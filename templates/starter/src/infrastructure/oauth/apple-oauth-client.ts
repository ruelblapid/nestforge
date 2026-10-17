import { importPKCS8, SignJWT } from 'jose';
import {
	AuthorizeParams,
	ExchangeParams,
	FetchLike,
	IOAuthClient,
	OAuthClientNotAllowedError,
	OAuthExchangeError,
	postForIdToken,
} from '../../application/oauth-client';

const AUTHORIZE_URL = 'https://appleid.apple.com/auth/authorize';
const TOKEN_URL = 'https://appleid.apple.com/auth/token';
const ISSUER = 'https://appleid.apple.com';

export interface AppleOAuthOptions {
	/** Accepted client IDs: the Services ID (web, first) and/or app bundle IDs (native). */
	clientIds: string[];
	teamId?: string;
	keyId?: string;
	/** Contents of the Sign in with Apple .p8 key. */
	privateKey?: string;
	fetch?: FetchLike;
}

export class AppleOAuthClient implements IOAuthClient {
	// Apple's token endpoint has no PKCE parameters; state and nonce carry the CSRF/replay protection.
	readonly supportsPkce = false;
	private readonly fetchFn: FetchLike;

	constructor(private readonly options: AppleOAuthOptions) {
		this.fetchFn = options.fetch ?? (globalThis.fetch as unknown as FetchLike);
	}

	private get webClientId(): string | undefined {
		return this.options.clientIds[0];
	}

	private get keyConfigured(): boolean {
		return Boolean(this.options.teamId && this.options.keyId && this.options.privateKey);
	}

	get redirectFlowEnabled(): boolean {
		return Boolean(this.webClientId && this.keyConfigured);
	}

	authorizeUrl(params: AuthorizeParams): string {
		const url = new URL(AUTHORIZE_URL);
		url.search = new URLSearchParams({
			client_id: this.webClientId ?? '',
			redirect_uri: params.redirectUri,
			response_type: 'code',
			// Requesting name/email makes Apple require form_post (a cross-site POST to our callback).
			response_mode: 'form_post',
			scope: 'name email',
			state: params.state,
			nonce: params.nonce,
		}).toString();
		return url.toString();
	}

	async exchangeCode(params: ExchangeParams): Promise<string> {
		const clientId = params.clientId ?? this.webClientId;
		if (!clientId || !this.options.clientIds.includes(clientId)) {
			throw new OAuthClientNotAllowedError('Unknown Apple client ID');
		}
		if (!this.keyConfigured) throw new OAuthExchangeError('Apple key is not configured');

		return postForIdToken(this.fetchFn, TOKEN_URL, {
			grant_type: 'authorization_code',
			code: params.code,
			client_id: clientId,
			redirect_uri: params.redirectUri,
			client_secret: await this.clientSecret(clientId),
		});
	}

	/** Apple's "client secret" is a short-lived ES256 JWT signed with the team's key. */
	private async clientSecret(clientId: string): Promise<string> {
		try {
			const key = await importPKCS8(this.options.privateKey!, 'ES256');
			return await new SignJWT({})
				.setProtectedHeader({ alg: 'ES256', kid: this.options.keyId })
				.setIssuer(this.options.teamId!)
				.setSubject(clientId)
				.setAudience(ISSUER)
				.setIssuedAt()
				.setExpirationTime('5m')
				.sign(key);
		} catch {
			throw new OAuthExchangeError('Could not sign the Apple client secret');
		}
	}
}
