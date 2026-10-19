#!/usr/bin/env bash
# .claude/scripts/check_architecture.sh
#
# Mechanical guard for the rules in .claude/references/architecture.md and code-style.md.
# Greps src/ for violations and exits non-zero if it finds any, so "follows our standards" is
# checked by a script instead of by eyeballing a diff. Pure bash + grep: no dependencies.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="$ROOT/src"
fail=0

# report <rule> <grep output>: prints the offending lines and marks the run as failed.
report() {
	local rule="$1" hits="$2"
	if [ -n "$hits" ]; then
		echo "FAIL: $rule"
		echo "$hits" | sed 's/^/    /'
		fail=1
	fi
}

# imports_in <dir> <regex> [exclude-regex]: import/export-from lines in <dir> whose module matches <regex>.
imports_in() {
	local dir="$1" pattern="$2" exclude="${3:-}"
	[ -d "$dir" ] || return 0
	local out
	out="$(grep -rnE --include='*.ts' "(from|import)[[:space:]]+['\"]([^'\"]*(${pattern})[^'\"]*)['\"]" "$dir" 2>/dev/null || true)"
	if [ -n "$exclude" ]; then
		out="$(echo "$out" | grep -vE "$exclude" || true)"
	fi
	echo "$out" | sed '/^$/d'
}

echo "Checking architecture rules in src/ ..."

# 1. Layer dependency rule -------------------------------------------------------------------
report "domain must not import Nest, Prisma, env, express or other layers" \
	"$(imports_in "$SRC/domain" '@nestjs/|@prisma/|generated/prisma|config/env|express|/application/|/api/|/infrastructure/|\.\./application|\.\./api|\.\./infrastructure')"

report "application must not import api, infrastructure, Prisma or express" \
	"$(imports_in "$SRC/application" '/api/|/infrastructure/|\.\./api|\.\./infrastructure|@prisma/|generated/prisma|express')"

report "infrastructure must not import api" \
	"$(imports_in "$SRC/infrastructure" '/api/|\.\./api')"

report "api must not import Prisma or repository interfaces (go through a service)" \
	"$(imports_in "$SRC/api" '@prisma/|generated/prisma|domain/repositories')"

report "api may import infrastructure only in health/metrics/request-context" \
	"$(imports_in "$SRC/api" '/infrastructure/|\.\./infrastructure' 'health\.controller\.ts|metrics\.controller\.ts|request-context\.middleware\.ts')"

# 2. Repositories ----------------------------------------------------------------------------
if [ -d "$SRC/infrastructure/repositories" ]; then
	report "repositories must not use findUnique (partial unique indexes + soft delete: use findFirst with deletedAt: null)" \
		"$(grep -rnE --include='*.ts' '\.findUnique(OrThrow)?\(' "$SRC/infrastructure" 2>/dev/null || true)"

	missing_live=""
	for f in "$SRC"/infrastructure/repositories/*.ts; do
		[ -e "$f" ] || continue
		if grep -qE '\.(findFirst|findMany|count|aggregate)\(' "$f" && ! grep -q 'LIVE' "$f"; then
			missing_live+="${f#$ROOT/}: reads rows but never applies the LIVE (deletedAt: null) filter"$'\n'
		fi
	done
	report "repository reads must exclude soft-deleted rows" "$(echo -n "$missing_live" | sed '/^$/d')"

	report "no unsafe raw SQL in src (use tagged-template \$queryRaw / \$executeRaw)" \
		"$(grep -rnE --include='*.ts' '\$(query|execute)RawUnsafe' "$SRC" 2>/dev/null || true)"
fi

# 3. Controllers -----------------------------------------------------------------------------
if [ -d "$SRC/api/controllers" ]; then
	report "@Body()/@Query() must go through new ZodValidationPipe(schema)" \
		"$(grep -rnE --include='*.ts' '@(Body|Query)\(\s*\)' "$SRC/api/controllers" 2>/dev/null || true)"
fi

# 4. Hygiene ---------------------------------------------------------------------------------
report "process.env may only be read in src/config/env.ts" \
	"$(grep -rn --include='*.ts' 'process\.env' "$SRC" 2>/dev/null | grep -v "^$SRC/config/env.ts" || true)"

report "no console.log in src (use Nest's Logger); main.ts is the only exception" \
	"$(grep -rn --include='*.ts' 'console\.log' "$SRC" 2>/dev/null | grep -v "^$SRC/main.ts" || true)"

report "no 'any' (use unknown and narrow, or a real type)" \
	"$(grep -rnE --include='*.ts' '(:\s*any\b|\bas any\b|<any>|any\[\])' "$SRC" 2>/dev/null | grep -vE '^\S+:[0-9]+:\s*(//|\*|/\*)' || true)"

report "no default exports in src (named exports only)" \
	"$(grep -rn --include='*.ts' '^export default' "$SRC" 2>/dev/null || true)"

report "no commented-out TypeScript statements left in src" \
	"$(grep -rnE --include='*.ts' '^\s*//\s*(import |export |const |let |await |return |if \(|for \()' "$SRC" 2>/dev/null || true)"

if [ "$fail" -ne 0 ]; then
	echo
	echo "Architecture check FAILED. See .claude/references/architecture.md and code-style.md."
	exit 1
fi

echo "Architecture check passed."
