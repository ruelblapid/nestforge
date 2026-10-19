# Auth Pattern

Email/password with JWT access + rotating refresh tokens, role-based access, and three social
sign-in flows. This is security-critical code: change it only when asked, keep the existing
safeguards, and add a test for any behavior you touch.

Files: `src/application/auth.service.ts`, `oauth.service.ts`, `identity-verifier.ts`,
`oauth-client.ts`; `src/api/security/security.ts`; `src/api/controllers/auth.controller.ts`,
`oauth.controller.ts`; `src/domain/auth-user.ts`, `role.ts`;
`src/infrastructure/jose-identity-verifier.ts`, `infrastructure/oauth/*`.

## Model

- `Auth` (table `auths`) holds credentials and roles; `Profile` holds personal data. They are
  created together in **one transaction** at registration.
- Roles are `Role.USER` (default) and `Role.ADMIN`, stored as `String[]` on `auths`. There is no
  endpoint that grants admin; promote a user in the database.
- Emails are trimmed and lowercased in the entity. Unique among live rows (partial index).

## Tokens

| Token | Secret | Lifetime | Stored |
| --- | --- | --- | --- |
| Access JWT | `JWT_SECRET` | `JWT_ACCESS_TTL_SECONDS` (900) | not stored |
| Refresh JWT | `JWT_REFRESH_SECRET` | `JWT_REFRESH_TTL_SECONDS` (604800) | SHA-256 hash on `auths.refresh_token_hash` |

- Payload: `{ sub, email, roles }`. Refresh tokens also carry a random `jwtid` so two issued in
  the same second differ.
- **Refresh rotates**: each use issues a new pair and replaces the stored hash; the old refresh
  token is rejected afterwards. Logout and password change clear the hash.
- Refresh tokens are hashed with **SHA-256, not bcrypt** (bcrypt only reads 72 bytes and the
  start of every JWT for a user is identical). Compare with `timingSafeEqual`.
- Passwords use bcrypt (10 rounds). Login compares against a dummy hash when the email is
  unknown so timing does not reveal which emails exist, and returns one generic message.

## Guards and decorators (`api/security/security.ts`)

- `JwtAuthGuard` is global and denies by default; `@Public()` opens a route.
- `RolesGuard` is global; `@Roles(Role.ADMIN)` restricts, no decorator means any authenticated
  user. Order in `AppModule`: `ThrottlerGuard`, `JwtAuthGuard`, `RolesGuard`.
- `@CurrentUser()` gives `{ id, email, roles }` from the verified access token.
- Authorization data in the token can be up to `JWT_ACCESS_TTL_SECONDS` stale. That is accepted;
  do not add per-request DB lookups without discussing it.

## Social sign-in

Three entry points, all ending in the same token pair (full table in the project README):

1. **ID token**: `POST /auth/google`, `POST /auth/apple` (native SDKs).
2. **Client-side code exchange (PKCE)**: `POST /auth/{google,apple}/code`.
3. **Browser redirect**: `GET /auth/{provider}/start`, provider callback, then
   `POST /auth/exchange` with a one-time code.

Safeguards to keep:

- Provider ID tokens are verified against the provider JWKS with `jose` (signature, issuer,
  audience, nonce). Audiences come from `GOOGLE_CLIENT_IDS` / `APPLE_CLIENT_IDS`; empty disables
  the provider.
- An existing account is **linked by email only when the provider says the email is verified**.
  Otherwise respond 409. Linking on an unverified email is an account takeover.
- The redirect flow's state, nonce and PKCE verifier live in a signed, HTTP-only cookie keyed
  from `JWT_SECRET` through a derived key (so it can never be confused with a JWT). The
  post-login redirect URL is fixed in config (`WEB_LOGIN_REDIRECT_URL`), never taken from the
  request (no open redirect).
- Tokens never appear in URLs. The redirect carries a 60-second, single-use code stored only as a
  hash and consumed atomically (`DELETE ... RETURNING`).
- The provider's client secret is only sent for the web client.

## Rules for new work

- A new protected route needs nothing extra (protected by default). A new open route needs
  `@Public()` and a reason.
- Never return or log password hashes, refresh token hashes, access/refresh tokens, login codes
  or provider tokens.
- Never put secrets in `.env.example`; use obviously fake placeholders and require 32+ characters.
- Credential endpoints keep their `@Throttle` limits.
- New failure messages on auth routes must not reveal which part was wrong.
- Add tests for: the success path, the wrong-credential path, the reuse/replay path, and
  anything involving roles.
