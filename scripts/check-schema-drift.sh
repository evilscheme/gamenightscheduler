#!/bin/bash
#
# Diff the public schema of two databases to detect drift.
#
# Default comparison: LOCAL Supabase (a fresh `npm run db:reset` = pure
# schema.sql) vs PRODUCTION (DATABASE_URL from .env.local). An empty diff
# means prod matches schema.sql.
#
# Usage:
#   npm run db:drift                          # local supabase vs prod
#   ./scripts/check-schema-drift.sh <url-A> <url-B>   # any two databases
#
# Both sides are dumped with the SAME local pg_dump binary (schema-only,
# public schema, no owners/ACLs) and normalized before diffing.

set -euo pipefail

LOCAL_DEFAULT="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

if [ $# -ge 2 ]; then
  URL_A="$1"; URL_B="$2"
  LABEL_A="database A"; LABEL_B="database B"
else
  URL_A="$LOCAL_DEFAULT"
  LABEL_A="local supabase (schema.sql — run 'npm run db:reset' first!)"
  if [ -f .env.local ]; then
    URL_B=$(grep -E "^DATABASE_URL=" .env.local | cut -d '=' -f2- | tr -d '"' | tr -d "'")
  fi
  LABEL_B="prod (DATABASE_URL)"
  if [ -z "${URL_B:-}" ]; then
    echo "Error: no DATABASE_URL in .env.local (or pass two URLs explicitly)" >&2
    exit 1
  fi
fi

dump() {
  # --schema=public only; strip comments/SET noise and the migration ledger,
  # which exists only on prod by design.
  pg_dump "$1" \
    --schema-only --schema=public --no-owner --no-acl \
    2>/dev/null \
  | grep -vE '^(--|SET |SELECT pg_catalog\.set_config)' \
  | grep -vE '^\\(un)?restrict ' \
  | sed '/^$/d' \
  | awk '/^CREATE TABLE public\._applied_migrations/,/^\);$/ {next} {print}' \
  | grep -vE '_applied_migrations'
}

TMP_A=$(mktemp); TMP_B=$(mktemp)
trap 'rm -f "$TMP_A" "$TMP_B"' EXIT

echo "Dumping $LABEL_A ..."
dump "$URL_A" > "$TMP_A"
echo "Dumping $LABEL_B ..."
dump "$URL_B" > "$TMP_B"

if diff -u --label "$LABEL_A" --label "$LABEL_B" "$TMP_A" "$TMP_B"; then
  echo ""
  echo "No drift: public schemas are identical."
else
  echo ""
  echo "DRIFT DETECTED (see diff above)."
  echo "If prod is behind, run: npm run db:migrate"
  echo "If schema.sql is behind, someone hand-edited prod — reconcile and add a migration."
  exit 1
fi
