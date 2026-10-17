import { randomInt } from 'crypto';

export const PASSWORD_MIN_LENGTH = 11;

// Requires at least one lowercase, one uppercase, one digit, and one
// non-alphanumeric character, with no whitespace, at the configured
// minimum length.
export const PASSWORD_PATTERN = new RegExp(
	`^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^a-zA-Z0-9\\s])[^\\s]{${PASSWORD_MIN_LENGTH},}$`
);

export const PASSWORD_REQUIREMENTS_MESSAGE = `Password must be at least ${PASSWORD_MIN_LENGTH} characters and include an uppercase letter, a lowercase letter, a number, and a special character`;

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SPECIAL = '!@#$%^&*()-_=+?';
const ALL_CHARS = LOWERCASE + UPPERCASE + DIGITS + SPECIAL;

function pickRandom(charset: string): string {
	return charset[randomInt(charset.length)];
}

/**
 * Generates a random password that satisfies PASSWORD_PATTERN: one char
 * from each required category, padded with random characters from the
 * full set, then shuffled so the required characters aren't always in
 * the same position.
 */
export function generateSecurePassword(
	length: number = PASSWORD_MIN_LENGTH
): string {
	const chars = [
		pickRandom(LOWERCASE),
		pickRandom(UPPERCASE),
		pickRandom(DIGITS),
		pickRandom(SPECIAL),
	];

	for (let i = chars.length; i < length; i++) {
		chars.push(pickRandom(ALL_CHARS));
	}

	for (let i = chars.length - 1; i > 0; i--) {
		const j = randomInt(i + 1);
		[chars[i], chars[j]] = [chars[j], chars[i]];
	}

	return chars.join('');
}
