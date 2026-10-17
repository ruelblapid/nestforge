import { OAuthProvider } from '../domain/auth-user';

export const IDENTITY_VERIFIER = Symbol('IDENTITY_VERIFIER');

export interface VerifiedIdentity {
	provider: OAuthProvider;
	/** The provider's stable user id (`sub`). */
	subject: string;
	/** Apple may omit the email on repeat sign-ins. */
	email?: string;
	/** True only if the provider vouches for the email address. */
	emailVerified: boolean;
	givenName?: string;
	familyName?: string;
}

export class IdentityProviderDisabledError extends Error {}
export class InvalidIdentityTokenError extends Error {}

/** Verifies a provider-issued ID token. Throws InvalidIdentityTokenError / IdentityProviderDisabledError. */
export interface IIdentityVerifier {
	verify(provider: OAuthProvider, idToken: string, expectedNonce?: string): Promise<VerifiedIdentity>;
}
