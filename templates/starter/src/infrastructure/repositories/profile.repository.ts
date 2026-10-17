import { buildPrismaQuery, IParameters, PrismaFieldMap } from 'nestforge';
import type { Prisma } from '../../../generated/prisma';
import { Profile } from '../../domain/profile';
import { IProfileRepository, Page } from '../../domain/repositories';
import { DbClient } from '../prisma/prisma.service';

/** Every read excludes soft-deleted rows; Prisma has no built-in soft delete. */
const LIVE = { deletedAt: null } as const;

type ProfileRow = NonNullable<Awaited<ReturnType<DbClient['profile']['findFirst']>>>;

/** API field name -> model field and type. Anything not listed is ignored, which keeps filters and sorts injection-safe. */
const FIELDS: PrismaFieldMap = {
	name: { field: 'name', kind: 'string' },
	lastname: { field: 'lastname', kind: 'string' },
	age: { field: 'age', kind: 'number' },
	createdAt: { field: 'createdAt', kind: 'date' },
};

export class ProfileRepository implements IProfileRepository {
	constructor(private readonly db: DbClient) {}

	async findById(id: string): Promise<Profile | null> {
		const row = await this.db.profile.findFirst({ where: { id, ...LIVE } });
		return row ? toDomain(row) : null;
	}

	async findByAuthId(authId: string): Promise<Profile | null> {
		const row = await this.db.profile.findFirst({ where: { authId, ...LIVE } });
		return row ? toDomain(row) : null;
	}

	async list(parameters: IParameters): Promise<Page<Profile>> {
		const query = buildPrismaQuery(parameters, FIELDS, { defaultSort: [{ field: 'createdAt', direction: 'desc' }] });
		const where = { ...LIVE, ...query.where } as Prisma.ProfileWhereInput;

		const [total, rows] = await Promise.all([
			this.db.profile.count({ where }),
			this.db.profile.findMany({
				where,
				orderBy: query.orderBy as Prisma.ProfileOrderByWithRelationInput[],
				skip: query.skip,
				take: query.take,
			}),
		]);
		return { items: rows.map(toDomain), total, page: query.page, size: query.size };
	}

	async save(profile: Profile): Promise<void> {
		const data = profile.toPrimitives();
		await this.db.profile.upsert({ where: { id: data.id }, create: data, update: data });
	}

	async softDelete(id: string): Promise<void> {
		await this.db.profile.updateMany({ where: { id, ...LIVE }, data: { deletedAt: new Date() } });
	}
}

function toDomain(row: ProfileRow): Profile {
	return Profile.restore({
		id: row.id,
		authId: row.authId,
		name: row.name,
		lastname: row.lastname,
		age: row.age,
	});
}
