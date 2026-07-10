#!/bin/bash
#
# Apply pending files from supabase/prod-migrations/ to the PRODUCTION database.
# Applied files are recorded in public._applied_migrations on the target, so
# re-runs only apply what's new.
#
# Usage:
#   npm run db:migrate                    # apply pending (asks for confirmation)
#   npm run db:migrate -- --status        # list applied + pending, change nothing
#   npm run db:migrate -- --dry-run       # show what WOULD be applied
#   ./scripts/prod-migrate.sh <postgresql://url> [--status|--dry-run]
#
# DATABASE_URL is read from the first argument if it looks like a URL,
# otherwise from the environment, otherwise from .env.local.

set -euo pipefail

MIGRATIONS_DIR="supabase/prod-migrations"
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

PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q)

# Ensure the ledger table exists (hidden from app roles: RLS on with no
# policies, and the blanket default-privilege grants revoked).
"${PSQL[@]}" <<'SQL'
CREATE TABLE IF NOT EXISTS public._applied_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public._applied_migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._applied_migrations FROM anon, authenticated;
SQL

applied=$("${PSQL[@]}" -Atc "SELECT name FROM public._applied_migrations ORDER BY name;")

pending=()
for file in "$MIGRATIONS_DIR"/*.sql; do
  [ -e "$file" ] || continue
  name=$(basename "$file")
  if ! grep -qx "$name" <<< "$applied"; then
    pending+=("$file")
  fi
done

if [ "$MODE" = "status" ]; then
  echo "Applied ($(grep -c . <<< "$applied" || true)):"
  sed 's/^/  /' <<< "$applied"
  echo "Pending (${#pending[@]}):"
  for f in "${pending[@]:-}"; do [ -n "$f" ] && echo "  $(basename "$f")"; done
  exit 0
fi

if [ ${#pending[@]} -eq 0 ]; then
  echo "Nothing pending — prod is at the chain head."
  exit 0
fi

echo "Pending migrations (in order):"
for f in "${pending[@]}"; do echo "  $(basename "$f")"; done

if [ "$MODE" = "dry-run" ]; then
  echo "(dry run — nothing applied)"
  exit 0
fi

host=$(sed -E 's|.*@([^:/]+).*|\1|' <<< "$DATABASE_URL")
echo ""
read -r -p "Apply ${#pending[@]} migration(s) to $host? Type 'apply' to continue: " confirm
if [ "$confirm" != "apply" ]; then
  echo "Aborted."
  exit 1
fi

for f in "${pending[@]}"; do
  name=$(basename "$f")
  echo "Applying $name ..."
  "${PSQL[@]}" -f "$f"
  "${PSQL[@]}" -c "INSERT INTO public._applied_migrations (name) VALUES ('$name');"
  echo "  recorded."
done

echo ""
echo "Done. Consider running: npm run db:drift"
