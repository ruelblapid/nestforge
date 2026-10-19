# Feature: Profiles

Code: `src/application/profile.service.ts`, `src/api/controllers/profile.controller.ts`,
`src/domain/profile.ts`, `src/infrastructure/repositories/profile.repository.ts`.

A profile is created together with the auth user at registration (one per user).

## Behavior

All routes are under `/api/profiles` and need a bearer token.

| Route | Access | Does |
| --- | --- | --- |
| `GET /me` | any user | returns the caller's profile |
| `PATCH /me` | any user | updates `name`, `lastname`, `age` (all optional, unknown keys rejected) |
| `GET /` | admin only | lists profiles with filter, sort and paging |

List query, e.g. `GET /api/profiles?filter[name][contains]=bo&sort=-createdAt&page[number]=1&page[size]=20`:

- `filter[name|lastname][equals|contains]`
- `filter[age][equals|gt|gte|lt|lte]`
- `filter[createdAt][gte|lte]`
- `sort` (prefix `-` for descending): `name`, `lastname`, `age`, `createdAt`; default `-createdAt`
- `page[number]`, `page[size]`

Response is `{ items, total, page, size }`. Soft-deleted profiles are never returned.
`contains` is case-insensitive and treats `%` and `_` literally.

## States and errors

- 400: invalid body, or an unknown filter, operator or sort field (all violations listed)
- 401: missing or invalid token
- 403: a non-admin calling the list
- 404: no profile for the caller (for example, the user was soft-deleted)

## Out of scope (for now)

- Deleting a profile through the API
- Viewing or editing another user's profile
- Avatars or file uploads

## Changelog

- 2026-10-19: documented from the existing implementation
