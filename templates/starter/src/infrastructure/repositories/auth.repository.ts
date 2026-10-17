import { AuthUser, OAuthProvider } from '../../domain/auth-user';
import { IAuthRepository } from '../../domain/repositories';
import { Role } from '../../domain/role';
import { DbClient } from '../prisma/prisma.service';

/** Every read excludes soft-deleted rows; Prisma has no built-in soft delete. */
const LIVE = { deletedAt: null } as const;

type AuthRow = NonNullable<Awaited<ReturnType<DbClient['auth']['findFirst']>>>;

export class AuthRepository implements IAuthRepository {
	constructor(private readonly db: DbClient) {}

	async findById(id: string): Promise<AuthUser | null> {
		const row = await this.db.auth.findFirst({ where: { id, ...LIVE } });
		return row ? toDomain(row) : null;
	}

	async findByEmail(email: string): Promise<AuthUser | null> {
		const row = await this.db.auth.findFirst({ where: { email: email.trim().toLowerCase(), ...LIVE } });
		return row ? toDomain(row) : null;
	}

	async findByProvider(provider: OAuthProvider, providerId: string): Promise<AuthUser | null> {
		const row = await this.db.auth.findFirst({
			where: { ...(provider === 'google' ? { googleId: providerId } : { appleId: providerId }), ...LIVE },
		});
		return row ? toDomain(row) : null;
	}

	async save(user: AuthUser): Promise<void> {
		const data = user.toPrimitives();
		await this.db.auth.upsert({ where: { id: data.id }, create: data, update: data });
	}

	async softDelete(id: string): Promise<void> {
		await this.db.auth.updateMany({ where: { id, ...LIVE }, data: { deletedAt: new Date() } });
	}
}

function toDomain(row: AuthRow): AuthUser {
	return AuthUser.restore({
		id: row.id,
		email: row.email,
		passwordHash: row.passwordHash,
		roles: row.roles as Role[],
		refreshTokenHash: row.refreshTokenHash,
		lastLoginAt: row.lastLoginAt,
		googleId: row.googleId,
		appleId: row.appleId,
	});
}
