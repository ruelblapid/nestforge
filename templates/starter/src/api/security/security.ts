import {
	CanActivate,
	createParamDecorator,
	ExecutionContext,
	ForbiddenException,
	Injectable,
	SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AccessTokenPayload } from '../../application/auth.service';
import { env } from '../../config/env';
import { Role } from '../../domain/role';

export interface AuthenticatedUser {
	id: string;
	email: string;
	roles: Role[];
}

const IS_PUBLIC = 'isPublic';
const ROLES = 'roles';

/** Routes are protected by default; mark open ones with @Public(). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator(
	(_data: unknown, ctx: ExecutionContext): AuthenticatedUser => ctx.switchToHttp().getRequest().user,
);

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor() {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: env.JWT_SECRET,
		});
	}

	validate(payload: AccessTokenPayload): AuthenticatedUser {
		return { id: payload.sub, email: payload.email, roles: payload.roles as Role[] };
	}
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
	constructor(private readonly reflector: Reflector) {
		super();
	}

	canActivate(context: ExecutionContext) {
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
		return isPublic ? true : super.canActivate(context);
	}
}

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, [
			context.getHandler(),
			context.getClass(),
		]);
		if (!required?.length) return true;
		const user: AuthenticatedUser | undefined = context.switchToHttp().getRequest().user;
		if (!user?.roles.some((r) => required.includes(r))) throw new ForbiddenException('Insufficient permissions');
		return true;
	}
}
