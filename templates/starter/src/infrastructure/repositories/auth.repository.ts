import { Repository } from 'typeorm';
import { AuthUser, OAuthProvider } from '../../domain/auth-user';
import { IAuthRepository } from '../../domain/repositories';
import { AuthEntity } from '../entities/auth.entity';

export class AuthRepository implements IAuthRepository {
	constructor(private readonly repo: Repository<AuthEntity>) {}

	async findById(id: string): Promise<AuthUser | null> {
		const row = await this.repo.findOne({ where: { id } });
		return row ? toDomain(row) : null;
	}

	async findByEmail(email: string): Promise<AuthUser | null> {
		const row = await this.repo.findOne({ where: { email: email.trim().toLowerCase() } });
		return row ? toDomain(row) : null;
	}

	async findByProvider(provider: OAuthProvider, providerId: string): Promise<AuthUser | null> {
		const row = await this.repo.findOne({
			where: provider === 'google' ? { googleId: providerId } : { appleId: providerId },
		});
		return row ? toDomain(row) : null;
	}

	async save(user: AuthUser): Promise<void> {
		await this.repo.save(this.repo.create(user.toPrimitives()));
	}

	async softDelete(id: string): Promise<void> {
		await this.repo.softDelete({ id });
	}
}

function toDomain(row: AuthEntity): AuthUser {
	return AuthUser.restore({
		id: row.id,
		email: row.email,
		passwordHash: row.passwordHash,
		roles: row.roles,
		refreshTokenHash: row.refreshTokenHash,
		lastLoginAt: row.lastLoginAt,
		googleId: row.googleId,
		appleId: row.appleId,
	});
}
