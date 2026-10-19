# Controllers and Schemas Pattern

Controllers are thin: validate the request, call one service method, return its `Result`.
`EitherInterceptor` (global) unwraps a `Right` into the response body and throws an
`ApiException` for a `Left`; `ApiExceptionFilter` (global) formats errors.

Living examples: `src/api/controllers/profile.controller.ts` (the template to copy),
`auth.controller.ts` (public routes, throttling, status codes), `oauth.controller.ts` (the
`@Res()` exception), `src/api/schemas/auth.schemas.ts`, `src/api/security/security.ts`,
`src/api/swagger.ts`.

## Schemas (`src/api/schemas/<area>.schemas.ts`)

One file per area. Export the schema and its inferred type together.

```ts
import { z } from 'zod';

export const createThingSchema = z.strictObject({
	title: z.string().trim().min(2).max(100),
	note: z.string().trim().max(500).optional(),
});
export type CreateThingBody = z.infer<typeof createThingSchema>;
```

- Use **`z.strictObject`** so unknown keys are rejected (400), not silently dropped.
- Bound every string (`max`) and number (`min`/`max`). Emails: `z.email().max(254)`.
- Passwords use `PASSWORD_PATTERN` / `PASSWORD_REQUIREMENTS_MESSAGE` from `nestforge`.
- Schemas validate shape and limits. Business rules (uniqueness, state) belong to entities and
  services, so a rule is never enforced in only one place.
- New domains get their own `<thing>.schemas.ts`; do not keep adding to `auth.schemas.ts`.

## Controller skeleton

```ts
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestforge';
import { ThingService } from '../../application/thing.service';
import { CreateThingBody, createThingSchema } from '../schemas/thing.schemas';
import { AuthenticatedUser, CurrentUser } from '../security/security';
import { bodySchema } from '../swagger';

@ApiTags('things')
@ApiBearerAuth()
@Controller('things')
export class ThingController {
	constructor(private readonly things: ThingService) {}

	@ApiBody({ schema: bodySchema(createThingSchema) })
	@Post()
	create(@CurrentUser() user: AuthenticatedUser, @Body(new ZodValidationPipe(createThingSchema)) body: CreateThingBody) {
		return this.things.create(user.id, body);
	}

	@Get(':id')
	get(@Param('id') id: string) {
		return this.things.get(id);
	}
}
```

## Rules

1. **Protected by default.** Open a route with `@Public()`; restrict with `@Roles(Role.ADMIN)`.
   Never weaken the global guards. If a route does not need a token, say why in a comment.
2. **Every `@Body()` and `@Query()` goes through `new ZodValidationPipe(schema)`.** A bare
   `@Body()` is a bug. Path params that are enums or ids use a pipe too
   (`@Param('provider', new ZodValidationPipe(providerSchema))`).
3. **Document request bodies**: `@ApiBody({ schema: bodySchema(schema) })` so Swagger reflects the
   Zod schema. Add `@ApiTags('<area>')`, and `@ApiBearerAuth()` on protected controllers or routes.
4. **No logic.** A handler is one `return this.service.method(...)`. No try/catch, no
   if/else on results, no repository access.
5. **Take identity from the token**: `@CurrentUser() user`, then `user.id`. "My data" routes
   live under `/me`. Never read an owner id from the body or path for self-service routes.
6. **Status codes:** `POST` that creates uses the default 201. A `POST` that is an action
   (login, refresh, exchange) uses `@HttpCode(200)`. No-content actions use `@HttpCode(204)` and
   the service returns `ok(null)`.
7. **Throttle credential-style routes** with `@Throttle`: register 5/min, login and social
   sign-in 10/min. The global default is 100/min.
8. **`@Res()` bypasses the interceptor.** Only for redirects/cookies. When you use it, convert a
   `Left` yourself with `throw new ApiException(message, code)` as `OAuthController.start` does.
9. **Global prefix is `api`** (set in `main.ts`; `/health` and `/metrics` are excluded). Route
   decorators never include `api`.

## List endpoints (filter, sort, paging)

Use nestforge's query engine. The controller declares what is allowed; the repository maps it.

```ts
/** e.g. GET /api/things?filter[title][contains]=bo&sort=-createdAt&page[number]=1&page[size]=20 */
@QuerySchema({
	filters: {
		title: { type: FilterValueType.STRING, operators: [Operator.EQUALS, Operator.CONTAINS] },
		createdAt: { type: FilterValueType.DATE, operators: [Operator.GTE, Operator.LTE] },
	},
	sort: ['title', 'createdAt'],
	pagination: true,
})
@ApiOperation({ summary: 'List things', description: 'Query: filter[title][equals|contains], filter[createdAt][gte|lte], sort (prefix - for descending), page[number], page[size].' })
@Roles(Role.ADMIN)
@Get()
list(@Params() parameters: IParameters) {
	return this.things.list(parameters);
}
```

Unknown filters, operators and sort fields are rejected with a 400 that lists every violation.
Keep the `@QuerySchema` and the repository's `FIELDS` map in step, and spell the allowed
query out in `@ApiOperation` (Swagger cannot infer it).

## Registering

Add the controller to `controllers` and the service to `providers` in `src/app.module.ts`.
