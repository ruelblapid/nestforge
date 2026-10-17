import { z } from 'zod';

export const providerSchema = z.enum(['google', 'apple']);

/** Query (Google) or form body (Apple) the provider sends to the redirect URI. */
export const callbackSchema = z.object({
	code: z.string().min(1).max(4096).optional(),
	state: z.string().min(1).max(512).optional(),
	error: z.string().max(256).optional(),
	/** Apple only, first authorization only: JSON string with the user's name. */
	user: z.string().max(4096).optional(),
});
export type CallbackBody = z.infer<typeof callbackSchema>;

export const exchangeSchema = z.strictObject({ code: z.string().min(1).max(512) });
export type ExchangeBody = z.infer<typeof exchangeSchema>;

export const clientCodeSchema = z.strictObject({
	code: z.string().min(1).max(4096),
	/** PKCE verifier the client generated for its authorize request (Google). */
	codeVerifier: z.string().min(43).max(128).optional(),
	/** Must equal the redirect URI the client used when it requested the code. */
	redirectUri: z.string().min(1).max(2048).optional(),
	/** Which configured client the code was issued to; defaults to the first (web) client. */
	clientId: z.string().min(1).max(256).optional(),
	/** Must equal the `nonce` claim in the ID token, if the client sent one in the authorize request. */
	nonce: z.string().min(1).optional(),
	/** Apple only returns the name to the client, on the first authorization. */
	firstName: z.string().trim().max(100).optional(),
	lastName: z.string().trim().max(100).optional(),
});
export type ClientCodeBody = z.infer<typeof clientCodeSchema>;
