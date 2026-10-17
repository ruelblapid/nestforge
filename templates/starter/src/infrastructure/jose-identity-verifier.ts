import { createRemoteJWKSet, JWTPayload, jwtVerify, JWTVerifyGetKey } from 'jose';
import { OAuthProvider } from '../domain/auth-user';
import {
	IdentityProviderDisabledError,
	IIdentityVerifier,
	InvalidIdentityTokenError,
	VerifiedIdentity,
} from '../application/identity-verifier';

interface ProviderConfig {
	issuers: string[];
	/** Accepted `aud` values (your OAuth client IDs). Empty = provider disabled. */
	audiences: string[];
	keys: JWTVerifyGetKey;
}

export interface JoseVerifierOptions {
	googleAudiences: string[];
	appleAudiences: string[];
	/** Override key sources (tests). Defaults to the providers' public JWKS endpoints. */
	googleKeys?: JWTVerifyGetKey;
	appleKeys?: JWTVerifyGetKey;
}

export class JoseIdentityVerifier implements IIdentityVerifier {
	private readonly providers: Record<OAuthProvider, ProviderConfig>;

	constructor(options: JoseVerifierOptions) {
		this.providers = {
			google: {
				issuers: ['https://accounts.google.com', 'accounts.google.com'],
				audiences: options.googleAudiences,
				// createRemoteJWKSet fetches lazily, caches, and re-fetches on key rotation.
				keys: options.googleKeys ?? createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs')),
			},
			apple: {
				issuers: ['https://appleid.apple.com'],
				audiences: options.appleAudiences,
				keys: options.appleKeys ?? createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys')),
			},
		};
	}

	async verify(provider: OAuthProvider, idToken: string, expectedNonce?: string): Promise<VerifiedIdentity> {
		const cfg = this.providers[provider];
		if (cfg.audiences.length === 0) throw new IdentityProviderDisabledError(`${provider} sign-in is not enabled`);

		let payload: JWTPayload;
		try {
			({ payload } = await jwtVerify(idToken, cfg.keys, {
				issuer: cfg.issuers,
				audience: cfg.audiences,
				clockTolerance: '5s',
				algorithms: ['RS256'],
			}));
		} catch (e) {
			throw new InvalidIdentityTokenError((e as Error).message);
		}

		if (!payload.sub) throw new InvalidIdentityTokenError('Missing subject');
		if (expectedNonce !== undefined && payload.nonce !== expectedNonce) {
			throw new InvalidIdentityTokenError('Nonce mismatch');
		}

		const email = typeof payload.email === 'string' && payload.email ? payload.email : undefined;
		return {
			provider,
			subject: String(payload.sub),
			email,
			// Apple sends email_verified as the string "true"; Google as a boolean.
			emailVerified: payload.email_verified === true || payload.email_verified === 'true',
			givenName: typeof payload.given_name === 'string' ? payload.given_name : undefined,
			familyName: typeof payload.family_name === 'string' ? payload.family_name : undefined,
		};
	}
}

export const parseClientIds = (value: string): string[] =>
	value
		.split(',')
		.map((v) => v.trim())
		.filter(Boolean);
