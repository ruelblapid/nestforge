# New Project Setup

Use this when this template has just been copied to start a **new, standalone** project. Inside
the nestforge monorepo the template resolves `nestforge` from the workspace; a standalone repo
cannot, so a few things must change. Do these in order, and report what you changed.

The library lives at https://github.com/ruelblapid/nestforge (package in `packages/nestforge`).

## 0. Make sure the standards came along

The new project must contain `CLAUDE.md` and the whole `.claude/` folder (`SKILL.md`,
`references/`, `scripts/`). Dot-folders are easy to drop when copying or scaffolding. Update
the first paragraph of `CLAUDE.md` with what the project actually is, and keep the rest.

## 1. package.json

- Set `"name"` to the project name.
- Add `"packageManager": "pnpm@11.2.2"` (match the nestforge repo).
- Replace `"nestforge": "workspace:*"` by installing it from git, **pinned to a commit** (never a
  branch):

  ```sh
  pnpm add "nestforge@github:ruelblapid/nestforge#<commit>&path:/packages/nestforge"
  ```

  Get the commit from `git ls-remote https://github.com/ruelblapid/nestforge HEAD` or the latest
  tag. The package has a `prepare` script, so pnpm builds `dist/` on install (adds about a minute to
  a cold install).

## 2. pnpm-workspace.yaml

pnpm 10+ blocks dependency build scripts unless allowed. Create `pnpm-workspace.yaml` at the
project root:

```yaml
allowBuilds:
  nestforge: true
  esbuild: true
  bcrypt: true
  "@swc/core": true
  "@scarf/scarf": false
  "@prisma/client": false
  "@prisma/engines": true
  prisma: true
```

(There is no `packages:` list because this is a single-package repo.)

## 3. Dockerfile and docker-compose.yml

The template Dockerfile is written for the monorepo (build context is the repo root, the app is at
`templates/starter`, and it builds the workspace `nestforge` package). For a standalone repo:

- Build context becomes the project root. In `docker-compose.yml` change `context: ../..` to
  `context: .` and `dockerfile: templates/starter/Dockerfile` to `dockerfile: Dockerfile`.
- In the Dockerfile: remove `pnpm --filter nestforge build`; change
  `pnpm --filter nestforge-starter build` to `pnpm build`; change
  `pnpm --filter nestforge-starter --prod --legacy deploy /out` to
  `pnpm --prod --legacy deploy /out`; change every `templates/starter/` path
  (`/repo/templates/starter/dist`, `.../generated`, `templates/starter/scripts/...`) to the root
  equivalents (`/repo/dist`, `/repo/generated`, `scripts/...`) and the `WORKDIR` of the
  `migrate` stage to `/repo`.
- The git-installed `nestforge` is built by `prepare` during `pnpm install`, so no separate step is
  needed. The image build needs `git` access to GitHub (it is public).
- Build, then run the compose `app` profile once to prove the image works.

## 4. Environment and local database

- `cp .env.example .env`.
- Change the database name/user/password in `.env.example`, `.env` and `docker-compose.yml` (all
  three must agree, plus the `pg_isready` healthcheck).
- Generate real `JWT_SECRET` and `JWT_REFRESH_SECRET` with `openssl rand -base64 48`.
- Never commit `.env`.

## 5. Branding

- `src/api/swagger.ts`: title, description, version.
- `package.json` description/version.
- README (create one if missing): what the project is, quick start, env table.

## 6. Decide what to keep

The template ships Auth (email/password + Google/Apple), Profiles, metrics and health. Ask the user
which parts the new project needs before deleting anything. Removing a feature means removing its
controller, service, schemas, tests, env vars and docs together, and the `CLAUDE.md` references to
them.

## 7. Verify from scratch

```sh
pnpm install
docker compose up -d --wait
pnpm db:migrate
pnpm typecheck && pnpm test && pnpm test:e2e
.claude/scripts/run_tests.sh
```

All green before the first feature is added.

## 8. Git and CI

- `git init`, make sure `.gitignore` covers `dist`, `node_modules`, `.env`, `*.tsbuildinfo`,
  `generated`.
- Copy the CI workflow from the nestforge repo (`.github/workflows/ci.yml`) and adapt the paths
  (no `--filter`, no `templates/starter`).
- First commit: `chore: scaffold project from nestforge starter`.

## Keeping up with nestforge

Updating the library is a deliberate change: bump the pinned commit, run `pnpm install`, then the
full test suite including e2e, and commit as `chore(deps): bump nestforge to <short-sha>`.
