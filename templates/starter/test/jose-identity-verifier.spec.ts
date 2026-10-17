import { createLocalJWKSet, exportJWK, generateKeyPair, KeyLike, SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { IdentityProviderDisabledError, InvalidIdentityTokenError } from '../src/application/identity-verifier';
import { JoseIdentityVerifier } from '../src/infrastructure/jose-identity-verifier';

let privateKey: KeyLike;
let verifier: JoseIdentityVerifier;

const sign = (claims: Record<string, unknown>, opts: { iss?: string; aud?: string; exp?: string; key?: KeyLike } = {}) =>
	new SignJWT(claims)
		.setProtectedHeader({ alg: 'RS256', kid: 'k1' })
		.setIssuer(opts.iss ?? 'https://accounts.google.com')
		.setAudience(opts.aud ?? 'my-client')
		.setSubject('sub-1')
		.setIssuedAt()
		.setExpirationTime(opts.exp ?? '5m')
		.sign(opts.key ?? privateKey);

beforeAll(async () => {
	const pair = await generateKeyPair('RS256', { extractable: true });
	privateKey = pair.privateKey;
	const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256' };
	const keys = createLocalJWKSet({ keys: [jwk] });
	verifier = new JoseIdentityVerifier({
		googleAudiences: ['my-client'],
		appleAudiences: [],
		googleKeys: keys,
		appleKeys: keys,
	});
});

describe('JoseIdentityVerifier', () => {
	it('accepts a valid token and maps claims', async () => {
		const token = await sign({ email: 'a@b.com', email_verified: true, given_name: 'Ann', nonce: 'n1' });
		await expect(verifier.verify('google', token, 'n1')).resolves.toMatchObject({
			subject: 'sub-1',
			email: 'a@b.com',
			emailVerified: true,
			givenName: 'Ann',
		});
	});

	it('treats Apple-style email_verified "true" as verified', async () => {
		const token = await sign({ email: 'a@b.com', email_verified: 'true' });
		expect((await verifier.verify('google', token)).emailVerified).toBe(true);
	});

	it.each([
		['wrong audience', { aud: 'someone-else' }],
		['wrong issuer', { iss: 'https://evil.example' }],
		['expired', { exp: '-1m' }],
	])('rejects a token with %s', async (_l, opts) => {
		const token = await sign({ email: 'a@b.com' }, opts);
		await expect(verifier.verify('google', token)).rejects.toBeInstanceOf(InvalidIdentityTokenError);
	});

	it('rejects a token signed by a different key', async () => {
		const other = await generateKeyPair('RS256');
		const token = await sign({ email: 'a@b.com' }, { key: other.privateKey });
		await expect(verifier.verify('google', token)).rejects.toBeInstanceOf(InvalidIdentityTokenError);
	});

	it('rejects a nonce mismatch', async () => {
		const token = await sign({ email: 'a@b.com', nonce: 'n1' });
		await expect(verifier.verify('google', token, 'other')).rejects.toBeInstanceOf(InvalidIdentityTokenError);
	});

	it('reports a provider with no client IDs as disabled', async () => {
		await expect(verifier.verify('apple', 'x')).rejects.toBeInstanceOf(IdentityProviderDisabledError);
	});
});
