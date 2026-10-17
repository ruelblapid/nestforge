import { v4 as uuid } from 'uuid';
import { fail, ok, Result, validationError } from './errors';

export interface ProfileProps {
	id: string;
	authId: string;
	name: string;
	lastname: string | null;
	age: number | null;
}

type ProfileFields = { name?: string; lastname?: string; age?: number };

export class Profile {
	private constructor(private props: ProfileProps) {}

	static create(input: ProfileFields & { authId: string; name: string }): Result<Profile> {
		const invalid = Profile.validate(input);
		if (invalid) return fail(validationError(invalid));
		return ok(
			new Profile({
				id: `profile-${uuid()}`,
				authId: input.authId,
				name: input.name.trim(),
				lastname: input.lastname?.trim() ?? null,
				age: input.age ?? null,
			}),
		);
	}

	static restore(props: ProfileProps) {
		return new Profile(props);
	}

	update(changes: ProfileFields): Result<Profile> {
		const invalid = Profile.validate(changes);
		if (invalid) return fail(validationError(invalid));
		if (changes.name !== undefined) this.props.name = changes.name.trim();
		if (changes.lastname !== undefined) this.props.lastname = changes.lastname.trim();
		if (changes.age !== undefined) this.props.age = changes.age;
		return ok(this);
	}

	private static validate(v: ProfileFields): string | null {
		if (v.name !== undefined && v.name.trim().length < 2) return 'Name must be at least 2 characters long';
		if (v.lastname !== undefined && v.lastname.trim().length < 2) return 'Lastname must be at least 2 characters long';
		if (v.age !== undefined && (v.age < 0 || v.age > 150)) return 'Age must be between 0 and 150';
		return null;
	}

	get id() {
		return this.props.id;
	}
	get authId() {
		return this.props.authId;
	}
	toPrimitives(): ProfileProps {
		return { ...this.props };
	}
}
