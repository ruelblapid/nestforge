import { PASSWORD_PATTERN, PASSWORD_REQUIREMENTS_MESSAGE } from 'nestforge';
import { z } from 'zod';

const password = z.string().regex(PASSWORD_PATTERN, PASSWORD_REQUIREMENTS_MESSAGE);

export const registerSchema = z.strictObject({
	email: z.email().max(254),
	password,
	name: z.string().trim().min(2).max(100),
	lastname: z.string().trim().min(2).max(100).optional(),
	age: z.number().int().min(0).max(150).optional(),
});
export type RegisterBody = z.infer<typeof registerSchema>;

export const loginSchema = z.strictObject({
	email: z.email(),
	password: z.string().min(1),
});
export type LoginBody = z.infer<typeof loginSchema>;

export const googleSignInSchema = z.strictObject({
	idToken: z.string().min(1),
	/** Must equal the `nonce` claim in the token, if you sent one to Google. */
	nonce: z.string().min(1).optional(),
});
export type GoogleSignInBody = z.infer<typeof googleSignInSchema>;

export const appleSignInSchema = googleSignInSchema.extend({
	// Apple only returns the name to the client on the very first authorization.
	firstName: z.string().trim().max(100).optional(),
	lastName: z.string().trim().max(100).optional(),
});
export type AppleSignInBody = z.infer<typeof appleSignInSchema>;

export const refreshSchema = z.strictObject({ refreshToken: z.string().min(1) });
export type RefreshBody = z.infer<typeof refreshSchema>;

export const changePasswordSchema = z.strictObject({
	oldPassword: z.string().min(1),
	newPassword: password,
});
export type ChangePasswordBody = z.infer<typeof changePasswordSchema>;

export const updateProfileSchema = z.strictObject({
	name: z.string().trim().min(2).max(100).optional(),
	lastname: z.string().trim().min(2).max(100).optional(),
	age: z.number().int().min(0).max(150).optional(),
});
export type UpdateProfileBody = z.infer<typeof updateProfileSchema>;
