# Commit Convention

Conventional Commits.

## Format

```
<type>(<scope>): <short summary>

<optional body: why, not just what>

<optional footer, e.g. Closes #123>
```

## Types

- `feat`: new feature
- `fix`: bug fix
- `refactor`: code change that does not change behavior
- `test`: adding or updating tests only
- `docs`: documentation only (`CLAUDE.md`, README)
- `chore`: tooling, dependencies, config, Docker, CI

## Scope

The area affected, lowercase: `auth`, `profiles`, `oauth`, `db`, `api`, `infra`, `config`,
`deps`, `ci`, or the new resource name (`things`).

## Rules

- Summary under 72 characters, imperative mood ("add", not "added" or "adds").
- One logical change per commit. Do not bundle an unrelated fix into a feature commit.
- A change to the Prisma schema and its migration is one commit (`feat(db): ...` or part of the
  feature). Never commit a schema edit without its migration.
- If a change updates both code and a `references/features/*.md` doc, that is still one
  `feat`/`fix` commit, not a separate `docs` commit.
- Mention destructive migrations, new required environment variables and new dependencies in the
  body so reviewers and deployers see them.
- Never commit `.env`, secrets, `dist/`, `generated/` or `node_modules/`.

## Example

```
feat(profiles): add admin list with filter, sort and paging

Adds GET /api/profiles behind @Roles(Role.ADMIN) using the nestforge query
engine. Filters are whitelisted in both the controller and the repository.

Closes #12
```
