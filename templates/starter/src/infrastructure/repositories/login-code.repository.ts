import { Repository } from 'typeorm';
import { ILoginCodeRepository } from '../../domain/repositories';
import { LoginCodeEntity } from '../entities/login-code.entity';

export class LoginCodeRepository implements ILoginCodeRepository {
	constructor(private readonly repo: Repository<LoginCodeEntity>) {}

	async issue(codeHash: string, authId: string, ttlSeconds: number): Promise<void> {
		// Expired rows are only ever dead weight; sweep them on the way in instead of needing a job.
		await this.repo.createQueryBuilder().delete().where('expires_at <= now()').execute();
		await this.repo.insert({ codeHash, authId, expiresAt: new Date(Date.now() + ttlSeconds * 1000) });
	}

	async consume(codeHash: string): Promise<string | null> {
		// One statement: two concurrent redemptions can't both get the row.
		const result = await this.repo
			.createQueryBuilder()
			.delete()
			.where('code_hash = :codeHash AND expires_at > now()', { codeHash })
			.returning('auth_id')
			.execute();
		const row = result.raw?.[0] as { auth_id: string } | undefined;
		return row?.auth_id ?? null;
	}
}
