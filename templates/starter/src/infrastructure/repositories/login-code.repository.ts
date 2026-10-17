import { ILoginCodeRepository } from '../../domain/repositories';
import { DbClient } from '../prisma/prisma.service';

export class LoginCodeRepository implements ILoginCodeRepository {
	constructor(private readonly db: DbClient) {}

	async issue(codeHash: string, authId: string, ttlSeconds: number): Promise<void> {
		// Expired rows are only ever dead weight; sweep them on the way in instead of needing a job.
		await this.db.loginCode.deleteMany({ where: { expiresAt: { lte: new Date() } } });
		// Expiry is computed by the database so the app and the check in `consume` share one clock.
		await this.db.$executeRaw`
			INSERT INTO login_codes (code_hash, auth_id, expires_at)
			VALUES (${codeHash}, ${authId}, now() + make_interval(secs => ${ttlSeconds}))`;
	}

	async consume(codeHash: string): Promise<string | null> {
		// One statement: two concurrent redemptions can't both get the row.
		const rows = await this.db.$queryRaw<{ auth_id: string }[]>`
			DELETE FROM login_codes WHERE code_hash = ${codeHash} AND expires_at > now() RETURNING auth_id`;
		return rows[0]?.auth_id ?? null;
	}
}
