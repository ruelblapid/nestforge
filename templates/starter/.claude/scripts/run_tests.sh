#!/usr/bin/env bash
# .claude/scripts/run_tests.sh: Solution layer for the nest-api-dev skill.
#
# Runs every check and exits non-zero on the first failure, so "the change is done" is gated on this
# script passing rather than on anyone eyeballing output.
#
#   .claude/scripts/run_tests.sh            architecture check + typecheck + unit tests
#   RUN_E2E=1 .claude/scripts/run_tests.sh  ... plus e2e tests (needs Postgres, see below)
#
# E2E needs `docker compose up -d --wait` and `pnpm db:migrate` first, and it TRUNCATEs tables.
# Run it whenever you touch repositories, the Prisma schema, auth or controllers.
#
# There is deliberately no lint step: the project has no lint script. Style is in code-style.md.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."

echo "==> Architecture check"
bash .claude/scripts/check_architecture.sh

echo "==> Type check"
pnpm typecheck

echo "==> Unit tests"
pnpm test

if [ "${RUN_E2E:-0}" = "1" ]; then
	echo "==> E2E tests (real Postgres)"
	pnpm test:e2e
else
	echo "==> E2E tests skipped (set RUN_E2E=1 to run them)"
fi

echo "All checks passed."
