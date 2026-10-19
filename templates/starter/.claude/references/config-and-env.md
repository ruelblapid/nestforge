# Config and Environment

All configuration is read once, validated with Zod, and exported as a typed `env` object from
`src/config/env.ts`. It is the **only** file allowed to read `process.env` in `src/`
(`prisma.config.ts` and tests are the other exceptions).

```ts
import { env } from '../config/env';   // use this everywhere
```

The app fails fast on startup with a readable list of what is wrong
(`Invalid environment: JWT_SECRET: ...`).

## Adding a variable

1. Add it to the schema in `src/config/env.ts`:
   - required: `FOO: z.string().min(1)`
   - with default: `FOO_TTL_SECONDS: z.coerce.number().default(900)`
   - optional that may be left blank in `.env`: wrap with the file's `optional(...)` helper, which
     turns `''` into `undefined`
   - booleans are `z.enum(['true', 'false'])` transformed to a boolean
   - URLs: `z.url()`; secrets: `.min(32)` (or 16 for bearer-style tokens)
2. Add it to `.env.example` with a safe placeholder and a one-line comment saying what it does and
   what blank means.
3. If compose or the Dockerfile needs it, add it there.
4. If a unit test imports a module that imports `config/env` (almost every service does), the test
   must set the required variables before the import with `vi.hoisted` (see
   `testing-conventions.md`). Update those blocks if you made the new variable required.
5. Mention user-facing variables in the feature doc or README.

## Rules

- Never read `process.env` directly in `src/`. Never read `env` in `domain/`.
- Defaults must be safe for production. Anything that loosens security (open metrics, Swagger on)
  must default to the safe value in production.
- Secrets are never committed. `.env` is gitignored; `.env.example` holds placeholders only.
- Generate real secrets with `openssl rand -base64 48`.
- `NODE_ENV` is `development | test | production`. Behavior that differs by environment
  (Swagger default, DB TLS, Prisma logging) is decided from `env`, in one place each.
