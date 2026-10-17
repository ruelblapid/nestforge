import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { Role } from '../../domain/role';
import { SoftDeletableEntity } from './soft-deletable.entity';

/** Persistence model. The domain `AuthUser` is mapped to/from this in the repository. */
@Entity('auths')
// Unique only among live rows so a soft-deleted user's email can be registered again.
@Index('uq_auths_email_live', ['email'], { unique: true, where: '"deleted_at" IS NULL' })
@Index('uq_auths_google_live', ['googleId'], { unique: true, where: '"deleted_at" IS NULL AND "google_id" IS NOT NULL' })
@Index('uq_auths_apple_live', ['appleId'], { unique: true, where: '"deleted_at" IS NULL AND "apple_id" IS NOT NULL' })
export class AuthEntity extends SoftDeletableEntity {
	@PrimaryColumn({ name: 'id' })
	id!: string;

	@Column({ name: 'email' })
	email!: string;

	@Column({ name: 'password_hash', type: 'varchar', nullable: true })
	passwordHash!: string | null;

	@Column('varchar', { name: 'roles', array: true, default: [Role.USER] })
	roles!: Role[];

	@Column({ name: 'refresh_token_hash', type: 'varchar', nullable: true })
	refreshTokenHash!: string | null;

	@Column({ name: 'google_id', type: 'varchar', nullable: true })
	googleId!: string | null;

	@Column({ name: 'apple_id', type: 'varchar', nullable: true })
	appleId!: string | null;

	@Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
	lastLoginAt!: Date | null;
}
