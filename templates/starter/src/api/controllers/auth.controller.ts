import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestforge';
import { AuthService } from '../../application/auth.service';
import {
	AppleSignInBody,
	appleSignInSchema,
	ChangePasswordBody,
	changePasswordSchema,
	GoogleSignInBody,
	googleSignInSchema,
	LoginBody,
	loginSchema,
	RefreshBody,
	refreshSchema,
	RegisterBody,
	registerSchema,
} from '../schemas/auth.schemas';
import { AuthenticatedUser, CurrentUser, Public } from '../security/security';

// Controllers return `Either`; the global EitherInterceptor unwraps Right / throws Left.
@Controller('auth')
export class AuthController {
	constructor(private readonly auth: AuthService) {}

	@Public()
	@Throttle({ default: { limit: 5, ttl: 60_000 } })
	@Post('register')
	register(@Body(new ZodValidationPipe(registerSchema)) body: RegisterBody) {
		return this.auth.register(body);
	}

	@Public()
	@Throttle({ default: { limit: 10, ttl: 60_000 } })
	@HttpCode(200)
	@Post('login')
	login(@Body(new ZodValidationPipe(loginSchema)) body: LoginBody) {
		return this.auth.login(body.email, body.password);
	}

	@Public()
	@Throttle({ default: { limit: 10, ttl: 60_000 } })
	@HttpCode(200)
	@Post('google')
	google(@Body(new ZodValidationPipe(googleSignInSchema)) body: GoogleSignInBody) {
		return this.auth.signInWithProvider('google', body.idToken, { nonce: body.nonce });
	}

	@Public()
	@Throttle({ default: { limit: 10, ttl: 60_000 } })
	@HttpCode(200)
	@Post('apple')
	apple(@Body(new ZodValidationPipe(appleSignInSchema)) body: AppleSignInBody) {
		return this.auth.signInWithProvider('apple', body.idToken, {
			nonce: body.nonce,
			firstName: body.firstName,
			lastName: body.lastName,
		});
	}

	@Public()
	@HttpCode(200)
	@Post('refresh')
	refresh(@Body(new ZodValidationPipe(refreshSchema)) body: RefreshBody) {
		return this.auth.refresh(body.refreshToken);
	}

	@HttpCode(204)
	@Post('logout')
	logout(@CurrentUser() user: AuthenticatedUser) {
		return this.auth.logout(user.id);
	}

	@HttpCode(204)
	@Post('change-password')
	changePassword(
		@CurrentUser() user: AuthenticatedUser,
		@Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordBody,
	) {
		return this.auth.changePassword(user.id, body.oldPassword, body.newPassword);
	}
}
