import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FilterValueType, IParameters, Operator, Params, QuerySchema, ZodValidationPipe } from 'nestforge';
import { ProfileService } from '../../application/profile.service';
import { Role } from '../../domain/role';
import { UpdateProfileBody, updateProfileSchema } from '../schemas/auth.schemas';
import { AuthenticatedUser, CurrentUser, Roles } from '../security/security';
import { bodySchema } from '../swagger';

@ApiTags('profiles')
@ApiBearerAuth()
@Controller('profiles')
export class ProfileController {
	constructor(private readonly profiles: ProfileService) {}

	@Get('me')
	getMine(@CurrentUser() user: AuthenticatedUser) {
		return this.profiles.getMine(user.id);
	}

	@ApiBody({ schema: bodySchema(updateProfileSchema) })
	@Patch('me')
	updateMine(
		@CurrentUser() user: AuthenticatedUser,
		@Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileBody,
	) {
		return this.profiles.updateMine(user.id, body);
	}

	/** e.g. GET /api/profiles?filter[name][contains]=bo&sort=-createdAt&page[number]=1&page[size]=20 */
	@QuerySchema({
		filters: {
			name: { type: FilterValueType.STRING, operators: [Operator.EQUALS, Operator.CONTAINS] },
			lastname: { type: FilterValueType.STRING, operators: [Operator.EQUALS, Operator.CONTAINS] },
			age: {
				type: FilterValueType.NUMBER,
				operators: [Operator.EQUALS, Operator.GT, Operator.GTE, Operator.LT, Operator.LTE],
			},
			createdAt: { type: FilterValueType.DATE, operators: [Operator.GTE, Operator.LTE] },
		},
		sort: ['name', 'lastname', 'age', 'createdAt'],
		pagination: true,
	})
	@ApiOperation({
		summary: 'List profiles (admin)',
		description: 'Query: filter[name|lastname][equals|contains], filter[age][equals|gt|gte|lt|lte], filter[createdAt][gte|lte], sort (prefix - for descending; name, lastname, age, createdAt), page[number], page[size].',
	})
	@Roles(Role.ADMIN)
	@Get()
	list(@Params() parameters: IParameters) {
		return this.profiles.list(parameters);
	}
}
