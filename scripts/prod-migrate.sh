#!/bin/bash
#
# Apply pending files from supabase/prod-migrations/ to the PRODUCTION database.
#
# Guarantees:
#   - Each migration file and its ledger record commit in ONE transaction
#     (psql --single-transaction), so a crash can never leave an applied file
#     unrecorded. Files must not contain transaction-control statements: a
#     comment-aware keyword scan rejects the obvious ones (BEGIN;/COMMIT/
#     ROLLBACK/SAVEPOINT/...), and a server-side check compares txid_current()
#     before and after the file body, so anything that escapes the runner's
#     transaction (e.g. a top-level END;, indistinguishable from plpgsql's by
#     scanning) aborts the run loudly instead of passing silently.
#   - A transaction-scoped advisory lock + the ledger's primary key serialize
#     concurrent runners; a double-apply rolls back the whole file.
#   - SHA-256 checksums are recorded and verified: editing an applied file is
#     detected and blocks the run. Legacy ledger rows without checksums are
#     backfilled (from current file content, announced) on the next apply.
#   - Nothing is written to the target — not even ledger DDL — before the
#     typed confirmation. --status and --dry-run never write at all, and
#     tolerate a pre-checksum ledger created by an older runner.
#
# Usage:
#   npm run db:migrate                 # apply pending (asks for confirmation)
#   npm run db:migrate:status          # read-only: list applied + pending
#   npm run db:migrate -- --dry-run    # read-only: show what WOULD be applied
#   ./scripts/prod-migrate.sh <postgresql://url> [--status|--dry-run]
#
# DATABASE_URL is read from the first URL argument, else the environment,
# else .env.local. Optional hard gate: set DB_MIGRATE_EXPECTED_IDENTITY (env
# or .env.local) to a substring that must appear in the server-verified
# identity or the connection URL (e.g. your Supabase project ref) — apply
# refuses to run against any other database. PROD_MIGRATIONS_DIR overrides
# the source directory (tests).

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

env_local() { [ -f .env.local ] && grep -E "^$1=" .env.local | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true; }

if [ -z "${DATABASE_URL:-}" ]; then
  DATABASE_URL=$(env_local DATABASE_URL)
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: no DATABASE_URL (argument, environment, or .env.local)" >&2
  exit 1
fi
EXPECTED_IDENTITY="${DB_MIGRATE_EXPECTED_IDENTITY:-$(env_local DB_MIGRATE_EXPECTED_IDENTITY)}"

PSQL=(psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1)

sha() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

# --- Read ledger state (tolerant of: no ledger, pre-checksum ledger) --------

ledger_exists=$("${PSQL[@]}" -Atc "SELECT (to_regclass('public._applied_migrations') IS NOT NULL)::text;")
has_checksum_col="false"
applied_rows=""
if [ "$ledger_exists" = "true" ]; then
  has_checksum_col=$("${PSQL[@]}" -Atc "SELECT (EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '_applied_migrations' AND column_name = 'checksum'))::text;")
  if [ "$has_checksum_col" = "true" ]; then
    applied_rows=$("${PSQL[@]}" -Atc "SELECT name || ' ' || COALESCE(checksum, '') FROM public._applied_migrations ORDER BY name;")
  else
    applied_rows=$("${PSQL[@]}" -Atc "SELECT name || ' ' FROM public._applied_migrations ORDER BY name;")
  fi
fi

is_applied() { awk -v n="$1" '$1 == n { found = 1 } END { exit !found }' <<< "$applied_rows"; }
recorded_sum() { awk -v n="$1" '$1 == n { print $2 }' <<< "$applied_rows"; }

# --- Validate files; compute pending -----------------------------------------

pending=()
backfill=()
problems=0
for file in "$MIGRATIONS_DIR"/*.sql; do
  [ -e "$file" ] || continue
  name=$(basename "$file")
  # Comment-aware scan for transaction control. Bare BEGIN (plpgsql block
  # opener) and END; (plpgsql block terminator) are legitimate and allowed;
  # everything the scan can't distinguish is caught server-side at apply time.
  if sed 's/--.*//' "$file" | grep -qiE '\b(COMMIT|ROLLBACK|ABORT|SAVEPOINT|PREPARE[[:space:]]+TRANSACTION|START[[:space:]]+TRANSACTION)\b|\bBEGIN[[:space:]]*(TRANSACTION|WORK)?[[:space:]]*;|\bEND[[:space:]]+(TRANSACTION|WORK)\b'; then
    echo "ERROR: $name contains transaction-control statements — the runner owns the transaction (see the README)." >&2
    problems=1
    continue
  fi
  if is_applied "$name"; then
    rec=$(recorded_sum "$name")
    cur=$(sha "$file")
    if [ -z "$rec" ]; then
      backfill+=("$name $cur")
    elif [ "$rec" != "$cur" ]; then
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

# --- Read-only modes ----------------------------------------------------------

if [ "$MODE" = "status" ]; then
  echo "Applied:"
  if [ -n "$applied_rows" ]; then
    awk '{ print "  " $1 ($2 == "" ? "  (no checksum recorded — will backfill on next apply)" : "") }' <<< "$applied_rows"
  else
    echo "  (none — ledger absent or empty)"
  fi
  echo "Pending (${#pending[@]}):"
  for f in "${pending[@]:-}"; do [ -n "$f" ] && echo "  $(basename "$f")"; done
  exit 0
fi

if [ ${#pending[@]} -eq 0 ] && [ ${#backfill[@]} -eq 0 ]; then
  echo "Nothing pending — database is at the chain head."
  exit 0
fi

if [ ${#pending[@]} -gt 0 ]; then
  echo "Pending migrations (in order):"
  for f in "${pending[@]}"; do echo "  $(basename "$f")"; done
fi
if [ ${#backfill[@]} -gt 0 ]; then
  echo "Checksum backfills for legacy ledger rows (recorded from current file content):"
  for b in "${backfill[@]}"; do echo "  ${b%% *}"; done
fi

if [ "$MODE" = "dry-run" ]; then
  echo "(dry run — nothing applied)"
  exit 0
fi

# --- Confirmation (nothing has been written up to this point) -----------------

identity=$("${PSQL[@]}" -Atc "SELECT current_database() || ' @ ' || COALESCE(inet_server_addr()::text || ':' || inet_server_port()::text, 'local socket') || ' as ' || current_user;")
stats=$("${PSQL[@]}" -Atc "SELECT (SELECT count(*) FROM public.users)::text || ' users, ' || (SELECT count(*) FROM public.games)::text || ' games'" 2>/dev/null || echo "row counts unavailable")

if [ -n "$EXPECTED_IDENTITY" ]; then
  if [[ "$identity" != *"$EXPECTED_IDENTITY"* && "$DATABASE_URL" != *"$EXPECTED_IDENTITY"* ]]; then
    echo "ERROR: DB_MIGRATE_EXPECTED_IDENTITY ('$EXPECTED_IDENTITY') matches neither the" >&2
    echo "       server-verified identity ($identity) nor the connection URL. Refusing." >&2
    exit 1
  fi
  gate_note="identity gate '$EXPECTED_IDENTITY' matched"
else
  gate_note="no identity gate — set DB_MIGRATE_EXPECTED_IDENTITY in .env.local to hard-gate this prompt"
fi

echo ""
echo "Target database: $identity"
echo "Contains:        $stats"
echo "Gate:            $gate_note"
read -r -p "Apply ${#pending[@]} migration(s) to THIS database? Type 'apply' to continue: " confirm
if [ "$confirm" != "apply" ]; then
  echo "Aborted."
  exit 1
fi

# --- First writes happen here: ledger DDL, backfills, then migrations ---------

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

for b in "${backfill[@]:-}"; do
  [ -n "$b" ] || continue
  bname="${b%% *}"
  bsum="${b##* }"
  "${PSQL[@]}" -c "UPDATE public._applied_migrations SET checksum = '$bsum' WHERE name = '$bname' AND checksum IS NULL;"
  echo "Backfilled checksum for $bname"
done

for f in "${pending[@]:-}"; do
  [ -n "$f" ] || continue
  name=$(basename "$f")
  sum=$(sha "$f")
  echo "Applying $name ..."
  # One transaction: advisory lock -> txid marker -> ledger insert -> file
  # body -> txid assertion. Concurrent runners serialize on the lock (the
  # loser rolls back on the ledger PK). The txid assertion proves the file
  # did not escape the runner's transaction; if it did, this aborts loudly —
  # inspect the ledger and database state before re-running.
  psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 --single-transaction \
    -c "DO \$runner\$ BEGIN PERFORM pg_advisory_xact_lock(hashtext('supabase/prod-migrations')); PERFORM set_config('migration.runner_txid', txid_current()::text, true); END \$runner\$;" \
    -c "INSERT INTO public._applied_migrations (name, checksum) VALUES ('$name', '$sum');" \
    -f "$f" \
    -c "DO \$runner\$ BEGIN IF current_setting('migration.runner_txid', true) IS DISTINCT FROM txid_current()::text THEN RAISE EXCEPTION 'migration escaped the runner transaction (transaction-control statement in the file?) — inspect ledger and database state before re-running'; END IF; END \$runner\$;"
  echo "  applied + recorded atomically."
done

echo ""
echo "Done. Consider running: npm run db:drift"
