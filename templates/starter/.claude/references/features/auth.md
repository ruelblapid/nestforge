# Feature: Auth

Code: `src/application/auth.service.ts`, `oauth.service.ts`, `src/api/controllers/auth.controller.ts`,
`oauth.controller.ts`, `src/domain/auth-user.ts`. Design notes: `../auth-pattern.md`.

## Behavior

All routes are under `/api/auth`. `Public` routes need no token.

| Route | Access | Does | Success |
| --- | --- | --- | --- |
| `POST /register` | public, 5/min | creates the auth user and profile in one transaction, returns tokens | 201 `{ accessToken, refreshToken, expiresIn }` |
| `POST /login` | public, 10/min | email + password | 200 tokens |
| `POST /refresh` | public | exchanges a refresh token for a new pair, old one stops working | 200 tokens |
| `POST /logout` | bearer | clears the stored refresh token | 204 |
| `POST /change-password` | bearer | verifies the old password, sets the new one, signs out everywhere | 204 |
| `POST /google`, `POST /apple` | public, 10/min | sign in or sign up with a provider ID token | 200 tokens |
| `POST /{google,apple}/code` | public, 10/min | sign in with an authorization code (PKCE) obtained by the client | 200 tokens |
| `GET /{google,apple}/start` | public, 20/min | redirects the browser to the provider and sets the signed state cookie | 302 |
| `GET`/`POST /{google,apple}/callback` | public, 20/min | finishes the redirect flow, redirects to `WEB_LOGIN_REDIRECT_URL?code=...` or `?error=...` | 302 |
| `POST /exchange` | public, 10/min | trades the one-time code for tokens (works once, 60s) | 200 tokens |

Registration rules: valid email (stored lowercase), password matching nestforge's
`PASSWORD_PATTERN`, `name` 2 to 100 characters, optional `lastname` and `age` (0 to 150).

## States and errors

- 400: invalid body (all violations listed), unknown fields, provider disabled or redirect flow not
  configured, new password equals old password.
- 401: wrong credentials (one generic message), invalid or reused refresh token, invalid provider
  token, invalid or expired login code, wrong current password.
- 409: email already registered (including a lost race between two simultaneous sign-ups), or a
  provider account whose email is unverified collides with an existing account.
- 429: rate limit exceeded.
- Redirect-flow errors reach the web app as `?error=` with one of `invalid_state`, `access_denied`,
  `exchange_failed`, `email_conflict`, `sign_in_failed`.

## Out of scope (for now)

- Forgot/reset password by email
- Email verification
- Account unlinking, per-session listing or revocation
- An endpoint to create or promote admins (done in the database)

## Changelog

- 2026-10-19: documented from the existing implementation
