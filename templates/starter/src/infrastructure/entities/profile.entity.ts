import { Column, Entity, Index, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { AuthEntity } from './auth.entity';
import { SoftDeletableEntity } from './soft-deletable.entity';

@Entity('profiles')
@Index('uq_profiles_auth_live', ['authId'], { unique: true, where: '"deleted_at" IS NULL' })
export class ProfileEntity extends SoftDeletableEntity {
	@PrimaryColumn({ name: 'id' })
	id!: string;

	@Column({ name: 'auth_id' })
	authId!: string;

	@OneToOne(() => AuthEntity)
	@JoinColumn({ name: 'auth_id' })
	auth?: AuthEntity;

	@Column({ name: 'name' })
	name!: string;

	@Column({ name: 'lastname', type: 'varchar', nullable: true })
	lastname!: string | null;

	@Column({ name: 'age', type: 'int', nullable: true })
	age!: number | null;
}
