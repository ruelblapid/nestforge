# Database and Migrations

PostgreSQL via Prisma 7 with the `pg` driver adapter. Schema in `prisma/schema.prisma`, SQL
migrations in `prisma/migrations`. **The app never changes the schema itself.**

## Daily workflow

```sh
docker compose up -d --wait               # local Postgres (credentials match .env.example)
pnpm db:migrate                           # apply committed migrations to a fresh database
pnpm db:migrate:dev --name add_things     # after editing schema.prisma: create + apply a migration
pnpm db:generate                          # regenerate the client (also runs on pnpm install)
pnpm db:studio                            # browse data
```

The client is generated to `generated/prisma` (gitignored). `prisma.config.ts` reads
`DATABASE_URL` (and optional `SHADOW_DATABASE_URL` for `migrate dev`/`migrate diff`).

## Adding or changing a model

1. Edit `prisma/schema.prisma`. Follow the existing models:
   - `id String @id` (the entity generates `prefix-uuid` ids; no database default)
   - snake_case columns with `@map`, plural snake_case tables with `@@map`
   - `createdAt`, `updatedAt` and `deletedAt` as `@db.Timestamptz`
   - `///` doc comments on models explaining anything non-obvious
2. `pnpm db:migrate:dev --name <what_changed>` and **read the generated SQL**.
3. If a uniqueness rule must ignore soft-deleted rows, edit the SQL (below).
4. Commit schema + migration together.
5. Add the table to the e2e `TRUNCATE` list (see `testing-conventions.md`).

Rules:

- Never edit a migration that has been applied anywhere shared. Write a new one.
- Never run `prisma migrate reset` or `prisma db push` against anything you care about.
- Destructive changes (drop column/table, type changes) get called out in the commit body and
  in your reply, and need a backfill or an explicit "data loss is fine here" from the user.
- Add indexes for columns used in filters/sorts that will grow large.

## Soft delete

Prisma has none built in. Tables with `deleted_at` are soft-deleted:

- Every repository read adds `{ deletedAt: null }` (the `LIVE` constant).
- `softDelete` sets `deletedAt` with `updateMany` filtered on `LIVE`.
- Any new query, including raw SQL, must exclude deleted rows too.

## Partial unique indexes (live rows only)

Uniqueness among live rows lets a deleted user's email be registered again. Prisma cannot express
the `WHERE`, so:

- `schema.prisma` declares a plain `@@unique([email], map: "uq_auths_email_live")`.
- The migration SQL creates it partial **under the same name**:

  ```sql
  CREATE UNIQUE INDEX "uq_auths_email_live" ON "auths"("email") WHERE "deleted_at" IS NULL;
  ```

- Keep the `WHERE` if migrations are regenerated or squashed.
- Look rows up with `findFirst({ where: { ..., deletedAt: null } })`, never `findUnique`.
- Name them `uq_<table>_<column>_live`.

## Drift and CI

CI runs `prisma migrate diff --from-migrations ... --to-schema ... --exit-code` against a shadow
database, so `schema.prisma` and the committed migrations must agree. If you edit one without the
other, CI fails.

## Deploying

Production does not migrate on start. Run the `migrate` image/target
(`prisma migrate deploy`) once per deploy, before rolling out the API. See
`observability-and-ops.md`.
