import { IParameters } from 'nestforge';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { IProfileRepository, Page } from '../../domain/repositories';
import { Profile } from '../../domain/profile';
import { ProfileEntity } from '../entities/profile.entity';

/** API field name -> column. Anything not listed here is ignored, which keeps filters/sorts injection-safe. */
const FILTERABLE: Record<string, string> = {
	name: 'p.name',
	lastname: 'p.lastname',
	age: 'p.age',
	createdAt: 'p.created_at',
};
const MAX_PAGE_SIZE = 100;

export class ProfileRepository implements IProfileRepository {
	constructor(private readonly repo: Repository<ProfileEntity>) {}

	async findById(id: string): Promise<Profile | null> {
		const row = await this.repo.findOne({ where: { id } });
		return row ? toDomain(row) : null;
	}

	async findByAuthId(authId: string): Promise<Profile | null> {
		const row = await this.repo.findOne({ where: { authId } });
		return row ? toDomain(row) : null;
	}

	async list(parameters: IParameters): Promise<Page<Profile>> {
		const qb = this.repo.createQueryBuilder('p');
		applyFilters(qb, parameters);
		applySort(qb, parameters);

		const paging = parameters.getPagingParameters();
		const page = Math.max(1, Number(paging?.getPage() ?? 1));
		const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(paging?.getSize() ?? 50)));
		qb.skip((page - 1) * size).take(size);

		const [rows, total] = await qb.getManyAndCount();
		return { items: rows.map(toDomain), total, page, size };
	}

	async save(profile: Profile): Promise<void> {
		await this.repo.save(this.repo.create(profile.toPrimitives()));
	}

	async softDelete(id: string): Promise<void> {
		await this.repo.softDelete({ id });
	}
}

function applyFilters(qb: SelectQueryBuilder<ProfileEntity>, parameters: IParameters) {
	if (!parameters.hasFilters()) return;
	let i = 0;
	for (const filter of parameters.getFilterParameters().getFilters()) {
		const column = FILTERABLE[filter.field.value];
		if (!column) continue;
		const op = filter.operator.value as string; // validated against the Operator enum
		const value = filter.value.value;
		const key = `f${i++}`;

		if (op === 'BETWEEN') {
			if (!Array.isArray(value) || value.length !== 2) continue;
			qb.andWhere(`${column} BETWEEN :${key}a AND :${key}b`, { [`${key}a`]: value[0], [`${key}b`]: value[1] });
		} else if (op === 'ILIKE' || op === 'NOT ILIKE') {
			qb.andWhere(`${column} ${op} :${key}`, { [key]: `%${String(value).replace(/[%_\\]/g, '\\$&')}%` });
		} else if (['=', '!=', '>', '>=', '<', '<='].includes(op)) {
			qb.andWhere(`${column} ${op} :${key}`, { [key]: value });
		}
	}
}

function applySort(qb: SelectQueryBuilder<ProfileEntity>, parameters: IParameters) {
	const sorts = parameters.hasSort() ? parameters.getSortParameters() : [];
	let applied = false;
	for (const sort of sorts) {
		const column = FILTERABLE[sort.getField()];
		if (!column) continue;
		applied ? qb.addOrderBy(column, sort.isAscending() ? 'ASC' : 'DESC') : qb.orderBy(column, sort.isAscending() ? 'ASC' : 'DESC');
		applied = true;
	}
	if (!applied) qb.orderBy('p.created_at', 'DESC');
}

function toDomain(row: ProfileEntity): Profile {
	return Profile.restore({
		id: row.id,
		authId: row.authId,
		name: row.name,
		lastname: row.lastname,
		age: row.age,
	});
}
