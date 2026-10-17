import { Inject, Injectable } from '@nestjs/common';
import { IParameters } from 'nestforge';
import { fail, notFoundError, ok, Result } from '../domain/errors';
import { Profile, ProfileProps } from '../domain/profile';
import { IProfileRepository, Page, PROFILE_REPOSITORY } from '../domain/repositories';

export type ProfileView = ProfileProps;

@Injectable()
export class ProfileService {
	constructor(@Inject(PROFILE_REPOSITORY) private readonly profiles: IProfileRepository) {}

	async getMine(authId: string): Promise<Result<ProfileView>> {
		const profile = await this.profiles.findByAuthId(authId);
		return profile ? ok(profile.toPrimitives()) : fail(notFoundError('Profile not found'));
	}

	async updateMine(
		authId: string,
		changes: { name?: string; lastname?: string; age?: number },
	): Promise<Result<ProfileView>> {
		const profile = await this.profiles.findByAuthId(authId);
		if (!profile) return fail(notFoundError('Profile not found'));

		const updated = profile.update(changes);
		if (updated.isLeft()) return fail(updated.getLeft());

		await this.profiles.save(profile);
		return ok(profile.toPrimitives());
	}

	async list(parameters: IParameters): Promise<Result<Page<ProfileView>>> {
		const page = await this.profiles.list(parameters);
		return ok({ ...page, items: page.items.map((p: Profile) => p.toPrimitives()) });
	}
}
