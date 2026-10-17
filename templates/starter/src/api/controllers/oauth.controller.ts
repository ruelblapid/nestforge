import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ApiException, ZodValidationPipe } from 'nestforge';
import { OAuthProvider } from '../../domain/auth-user';
import { OAuthService, STATE_COOKIE } from '../../application/oauth.service';
import {
	CallbackBody,
	callbackSchema,
	ClientCodeBody,
	clientCodeSchema,
	ExchangeBody,
	exchangeSchema,
	providerSchema,
} from '../schemas/oauth.schemas';
import { Public } from '../security/security';
import { bodySchema } from '../swagger';

const redirectRateLimit = { default: { limit: 20, ttl: 60_000 } };

/**
 * Authorization-code sign-in, two ways:
 *  - browser redirect: GET /auth/:provider/start -> provider -> /auth/:provider/callback -> web app (?code=)
 *    -> POST /auth/exchange
 *  - client-side exchange (mobile / SPA with PKCE): POST /auth/:provider/code
 * Either way the result is the same token pair as the other sign-in routes.
 */
@ApiTags('auth')
@Public()
@Controller('auth')
export class OAuthController {
	constructor(private readonly oauth: OAuthService) {}

	@ApiOperation({ summary: 'Start a browser sign-in: redirects to Google / Apple' })
	@Throttle(redirectRateLimit)
	@Get(':provider/start')
	start(@Param('provider', new ZodValidationPipe(providerSchema)) provider: OAuthProvider, @Res() res: Response) {
		const started = this.oauth.start(provider);
		if (started.isLeft()) {
			// Same mapping EitherInterceptor applies, which @Res() bypasses.
			const error = started.getLeft() as { message?: string; code?: number };
			throw new ApiException(error.message ?? 'Request failed', error.code ?? 400);
		}
		const { url, cookie } = started.getRight();
		res.cookie(cookie.name, cookie.value, {
			httpOnly: true,
			secure: cookie.secure,
			sameSite: cookie.sameSite,
			maxAge: cookie.maxAgeSeconds * 1000,
			path: '/api/auth',
		});
		res.redirect(302, url);
	}

	/** Google redirects with GET; Apple (response_mode=form_post) posts a form. */
	@ApiOperation({ summary: 'Provider redirect target; sends the browser on to the web app' })
	@Throttle(redirectRateLimit)
	@Get(':provider/callback')
	callbackGet(
		@Param('provider', new ZodValidationPipe(providerSchema)) provider: OAuthProvider,
		@Query(new ZodValidationPipe(callbackSchema)) query: CallbackBody,
		@Req() req: Request,
		@Res() res: Response,
	) {
		return this.finish(provider, query, req, res);
	}

	@ApiOperation({ summary: 'Provider redirect target (form_post); sends the browser on to the web app' })
	@Throttle(redirectRateLimit)
	@Post(':provider/callback')
	callbackPost(
		@Param('provider', new ZodValidationPipe(providerSchema)) provider: OAuthProvider,
		@Body(new ZodValidationPipe(callbackSchema)) body: CallbackBody,
		@Req() req: Request,
		@Res() res: Response,
	) {
		return this.finish(provider, body, req, res);
	}

	@ApiOperation({ summary: 'Trade the one-time code from the web redirect for tokens' })
	@ApiBody({ schema: bodySchema(exchangeSchema) })
	@Throttle({ default: { limit: 10, ttl: 60_000 } })
	@HttpCode(200)
	@Post('exchange')
	exchange(@Body(new ZodValidationPipe(exchangeSchema)) body: ExchangeBody) {
		return this.oauth.redeemLoginCode(body.code);
	}

	@ApiOperation({ summary: 'Sign in with an authorization code obtained by the client (PKCE)' })
	@ApiBody({ schema: bodySchema(clientCodeSchema) })
	@Throttle({ default: { limit: 10, ttl: 60_000 } })
	@HttpCode(200)
	@Post(':provider/code')
	code(
		@Param('provider', new ZodValidationPipe(providerSchema)) provider: OAuthProvider,
		@Body(new ZodValidationPipe(clientCodeSchema)) body: ClientCodeBody,
	) {
		return this.oauth.signInWithCode(provider, body);
	}

	private async finish(provider: OAuthProvider, input: CallbackBody, req: Request, res: Response) {
		if (!this.oauth.redirectEnabled(provider)) {
			throw new ApiException(`${provider} redirect sign-in is not enabled`, 400);
		}
		const target = await this.oauth.complete(provider, input, readCookie(req.headers.cookie, STATE_COOKIE));
		// The state cookie is single use whether or not sign-in succeeded.
		res.clearCookie(STATE_COOKIE, { path: '/api/auth' });
		res.redirect(302, target);
	}
}

function readCookie(header: string | undefined, name: string): string | undefined {
	for (const part of header?.split(';') ?? []) {
		const eq = part.indexOf('=');
		if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
	}
	return undefined;
}
