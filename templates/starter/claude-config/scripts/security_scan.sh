#!/usr/bin/env bash
# .claude/scripts/security_scan.sh
#
# Collects the facts a security review needs (route protection inventory, raw SQL, secrets, HTTP
# hardening, production defaults, dependency audit). Informational sections only print; the script
# exits non-zero for hard failures: a tracked .env, a hard-coded secret, unsafe raw SQL.
# Pure bash + grep (plus git and pnpm when available).

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="$ROOT/src"
fail=0

section() { printf '\n== %s ==\n' "$1"; }

section "Route inventory (file:line decorator; read the handlers behind any @Public)"
# Class-level and method-level decorators that decide who can call what.
grep -rnE --include='*.ts' '@(Controller|Public|Roles|Throttle|SkipThrottle|Get|Post|Put|Patch|Delete)\(' "$SRC/api/controllers" 2>/dev/null \
	| sed "s#^$ROOT/##" || true

section "Global guards and provider wiring"
grep -nE 'APP_(GUARD|FILTER|INTERCEPTOR)' "$SRC/app.module.ts" 2>/dev/null | sed "s#^#src/app.module.ts:#" || true

section "Request validation: @Body/@Query/@Param without ZodValidationPipe"
grep -rnE --include='*.ts' '@(Body|Query)\(\s*\)' "$SRC/api" 2>/dev/null | sed "s#^$ROOT/##" || true
grep -rnE --include='*.ts' '@Param\(' "$SRC/api" 2>/dev/null | grep -v ZodValidationPipe | sed "s#^$ROOT/##" || true

section "Raw SQL"
grep -rnE --include='*.ts' '\$(query|execute)Raw(Unsafe)?' "$SRC" 2>/dev/null | sed "s#^$ROOT/##" || true
unsafe="$(grep -rnE --include='*.ts' '\$(query|execute)RawUnsafe' "$SRC" 2>/dev/null || true)"
if [ -n "$unsafe" ]; then
	echo "FAIL: unsafe raw SQL in src"
	echo "$unsafe" | sed "s#^$ROOT/##; s/^/    /"
	fail=1
fi

section "Hard-coded secrets in src (patterns only; values are not printed)"
secrets="$(grep -rnEi --include='*.ts' "(secret|password|passwd|api_?key|private_?key|token)[A-Za-z_]*[[:space:]]*[:=][[:space:]]*['\"][^'\"]{12,}['\"]" "$SRC" 2>/dev/null | grep -vE "['\"]https?://" || true)"
if [ -n "$secrets" ]; then
	echo "FAIL: possible hard-coded secret (rotate it if real):"
	echo "$secrets" | cut -d: -f1,2 | sed "s#^$ROOT/##; s/^/    /"
	fail=1
else
	echo "none found"
fi

section "Secrets in version control"
if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
	if git -C "$ROOT" ls-files --error-unmatch .env >/dev/null 2>&1; then
		echo "FAIL: .env is tracked by git. Remove it from the index and rotate every secret in it."
		fail=1
	else
		echo ".env is not tracked"
	fi
	grep -qE '^\.env$' "$ROOT/.gitignore" 2>/dev/null && echo ".env is in .gitignore" || { echo "FAIL: .env is not in .gitignore"; fail=1; }
else
	echo "not a git repository; skipped"
fi

section "HTTP hardening in main.ts / dependencies (informational)"
if grep -qiE 'helmet' "$SRC/main.ts" "$ROOT/package.json" 2>/dev/null; then echo "helmet: configured"; else echo "helmet: NOT configured"; fi
if grep -qiE 'enableCors|cors' "$SRC/main.ts" 2>/dev/null; then echo "CORS: configured"; else echo "CORS: NOT configured (browsers block cross-origin calls; fine for server-to-server APIs)"; fi

section "Production defaults (informational)"
grep -nE 'SWAGGER_ENABLED|METRICS_TOKEN|DATABASE_SSL' "$SRC/config/env.ts" "$SRC/main.ts" 2>/dev/null | sed "s#^$ROOT/##" || true

section "Dependency audit (pnpm audit --prod)"
if command -v pnpm >/dev/null 2>&1; then
	(cd "$ROOT" && pnpm audit --prod 2>&1 | tail -n 25) || echo "audit reported issues or could not reach the registry"
else
	echo "pnpm not found; audit not run"
fi

printf '\n'
if [ "$fail" -ne 0 ]; then
	echo "Security scan FAILED (hard failures above)."
	exit 1
fi
echo "Security scan finished: no hard failures. Review the inventory above."
