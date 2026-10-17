import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** One-time code handed to the browser after a redirect sign-in. Only the SHA-256 of the code is stored. */
@Entity('login_codes')
export class LoginCodeEntity {
	@PrimaryColumn({ name: 'code_hash' })
	codeHash!: string;

	@Column({ name: 'auth_id' })
	authId!: string;

	@Index('idx_login_codes_expires_at')
	@Column({ name: 'expires_at', type: 'timestamptz' })
	expiresAt!: Date;
}
