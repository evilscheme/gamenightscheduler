#!/bin/bash
#
# Apply pending files from supabase/prod-migrations/ to the PRODUCTION database.
#
# Guarantees:
#   - Each migration file and its ledger record commit in ONE transaction
#     (psql --single-transaction), so a crash can never leave an applied file
#     unrecorded. Files must NOT contain their own BEGIN/COMMIT (enforced).
#   - A transaction-scoped advisory lock + the ledger's primary key serialize
#     concurrent runners; a double-apply rolls back the whole file.
#   - SHA-256 checksums are recorded and verified: editing an applied file is
#     detected and blocks the run (applied files are immutable).
#   - --status and --dry-run are strictly read-only (no ledger DDL).
#
# Usage:
#   npm run db:migrate                 # apply pending (asks for confirmation)
#   npm run db:migrate:status          # read-only: list applied + pending
#   npm run db:migrate -- --dry-run    # read-only: show what WOULD be applied
#   ./scripts/prod-migrate.sh <postgresql://url> [--status|--dry-run]
#
# DATABASE_URL is read from the first URL argument, else the environment,
# else .env.local. PROD_MIGRATIONS_DIR overrides the source directory (tests).

set -euo pipefail

MIGRATIONS_DIR="${PROD_MIGRATIONS_DIR:-supabase/prod-migrations}"
MODE="apply"

for arg in "$@"; do
  case "$arg" in
    --status) MODE="status" ;;
    --dry-run) MODE="dry-run" ;;
    postgresql://*|postgres://*) DATABASE_URL="$arg" ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

if [ -z "${DATABASE_URL:-}" ] && [ -f .env.local ]; then
  DATABASE_URL=$(grep -E "^DATABASE_URL=" .env.local | cut -d '=' -f2- | tr -d '"' | tr -d "'")
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: no DATABASE_URL (argument, environment, or .env.local)" >&2
  exit 1
fi

PSQL=(psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1)

sha() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

ledger_exists=$("${PSQL[@]}" -Atc "SELECT (to_regclass('public._applied_migrations') IS NOT NULL)::text;")

# Ledger DDL runs ONLY in apply mode — status/dry-run never write anything.
if [ "$MODE" = "apply" ]; then
  "${PSQL[@]}" <<'SQL'
SET client_min_messages = warning;
CREATE TABLE IF NOT EXISTS public._applied_migrations (
  name TEXT PRIMARY KEY,
  checksum TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public._applied_migrations ADD COLUMN IF NOT EXISTS checksum TEXT;
ALTER TABLE public._applied_migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._applied_migrations FROM anon, authenticated;
SQL
  ledger_exists="true"
fi

# "name<space>checksum" per line (checksum may be empty on pre-checksum rows).
applied_rows=""
if [ "$ledger_exists" = "true" ]; then
  applied_rows=$("${PSQL[@]}" -Atc "SELECT name || ' ' || COALESCE(checksum, '') FROM public._applied_migrations ORDER BY name;")
fi

is_applied() { awk -v n="$1" '$1 == n { found = 1 } END { exit !found }' <<< "$applied_rows"; }
recorded_sum() { awk -v n="$1" '$1 == n { print $2 }' <<< "$applied_rows"; }

pending=()
problems=0
for file in "$MIGRATIONS_DIR"/*.sql; do
  [ -e "$file" ] || continue
  name=$(basename "$file")
  if grep -qiE '^[[:space:]]*(BEGIN|COMMIT)[[:space:]]*;' "$file"; then
    echo "ERROR: $name contains its own BEGIN/COMMIT — the runner owns the transaction (see the README)." >&2
    problems=1
    continue
  fi
  if is_applied "$name"; then
    rec=$(recorded_sum "$name")
    cur=$(sha "$file")
    if [ -n "$rec" ] && [ "$rec" != "$cur" ]; then
      echo "ERROR: applied migration $name has been EDITED (checksum mismatch)." >&2
      echo "       Applied files are immutable — restore it and add a new migration instead." >&2
      problems=1
    fi
  else
    pending+=("$file")
  fi
done
if [ "$problems" -ne 0 ]; then
  exit 1
fi

if [ "$MODE" = "status" ]; then
  echo "Applied:"
  if [ -n "$applied_rows" ]; then
    awk '{ print "  " $1 ($2 == "" ? "  (no checksum recorded)" : "") }' <<< "$applied_rows"
  else
    echo "  (none — ledger absent or empty)"
  fi
  echo "Pending (${#pending[@]}):"
  for f in "${pending[@]:-}"; do [ -n "$f" ] && echo "  $(basename "$f")"; done
  exit 0
fi

if [ ${#pending[@]} -eq 0 ]; then
  echo "Nothing pending — database is at the chain head."
  exit 0
fi

echo "Pending migrations (in order):"
for f in "${pending[@]}"; do echo "  $(basename "$f")"; done

if [ "$MODE" = "dry-run" ]; then
  echo "(dry run — nothing applied)"
  exit 0
fi

# Server-verified identity (not the parsed URL): database, address, role, and
# live row counts so prod is unmistakable at the prompt.
identity=$("${PSQL[@]}" -Atc "SELECT current_database() || ' @ ' || COALESCE(inet_server_addr()::text || ':' || inet_server_port()::text, 'local socket') || ' as ' || current_user;")
stats=$("${PSQL[@]}" -Atc "SELECT (SELECT count(*) FROM public.users)::text || ' users, ' || (SELECT count(*) FROM public.games)::text || ' games'" 2>/dev/null || echo "row counts unavailable")

echo ""
echo "Target database: $identity"
echo "Contains:        $stats"
read -r -p "Apply ${#pending[@]} migration(s) to THIS database? Type 'apply' to continue: " confirm
if [ "$confirm" != "apply" ]; then
  echo "Aborted."
  exit 1
fi

for f in "${pending[@]}"; do
  name=$(basename "$f")
  sum=$(sha "$f")
  echo "Applying $name ..."
  # One transaction: advisory lock -> ledger insert -> migration body.
  # Concurrent runners serialize on the lock; the second one's ledger insert
  # then hits the primary key and rolls back the whole file.
  psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 --single-transaction \
    -c "DO \$\$ BEGIN PERFORM pg_advisory_xact_lock(hashtext('supabase/prod-migrations')); END \$\$;" \
    -c "INSERT INTO public._applied_migrations (name, checksum) VALUES ('$name', '$sum');" \
    -f "$f"
  echo "  applied + recorded atomically."
done

echo ""
echo "Done. Consider running: npm run db:drift"
