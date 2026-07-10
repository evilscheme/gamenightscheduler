#!/bin/bash
#
# Compare supabase/schema.sql against a live database (default: PROD).
#
# Default mode builds a THROWAWAY reference database from schema.sql on the
# local Supabase cluster — the reference is always exactly schema.sql, never a
# possibly-stale dev database — then compares two things:
#   1. Structure: pg_dump --schema-only --schema=public, normalized.
#   2. Privileges: anon/authenticated EXECUTE on every public function and
#      table-level rights on every public table (catalog queries), because the
#      structural dump deliberately omits ACLs and this app's security posture
#      depends on function grant lockdown.
#
# Usage:
#   npm run db:drift                        # schema.sql vs prod (DATABASE_URL)
#   ./scripts/check-schema-drift.sh <A> <B> # any two live databases
#
# Env:
#   DRIFT_CLUSTER_URL  cluster on which the throwaway reference DB is built
#                      (default: local Supabase; must be running: npm run db:start)

set -euo pipefail

CLUSTER_URL="${DRIFT_CLUSTER_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
TEMP_DB="_schema_drift_ref"

cleanup() {
  if [ "${BUILT_REF:-}" = "1" ]; then
    psql "$CLUSTER_URL" -X -q -c "DROP DATABASE IF EXISTS $TEMP_DB WITH (FORCE);" >/dev/null 2>&1 || true
  fi
  rm -f "${TMP_A:-}" "${TMP_B:-}" "${PRIV_A:-}" "${PRIV_B:-}"
}
trap cleanup EXIT

if [ $# -ge 2 ]; then
  URL_A="$1"; URL_B="$2"
  LABEL_A="database A"; LABEL_B="database B"
else
  if [ -f .env.local ]; then
    URL_B=$(grep -E "^DATABASE_URL=" .env.local | cut -d '=' -f2- | tr -d '"' | tr -d "'")
  fi
  if [ -z "${URL_B:-}" ]; then
    echo "Error: no DATABASE_URL in .env.local (or pass two URLs explicitly)" >&2
    exit 1
  fi
  LABEL_B="prod (DATABASE_URL)"
  LABEL_A="schema.sql (fresh reference)"

  echo "Building reference database from supabase/schema.sql ..."
  psql "$CLUSTER_URL" -X -q -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $TEMP_DB WITH (FORCE);"
  psql "$CLUSTER_URL" -X -q -v ON_ERROR_STOP=1 -c "CREATE DATABASE $TEMP_DB;"
  BUILT_REF=1
  URL_A="${CLUSTER_URL%/*}/$TEMP_DB"
  # Stub the auth surface schema.sql references (roles exist cluster-wide on
  # Supabase; the DO block covers plain-postgres clusters used in tests).
  psql "$URL_A" -X -q -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT NULL::uuid';
SQL
  psql "$URL_A" -X -q -v ON_ERROR_STOP=1 -f supabase/schema.sql >/dev/null
fi

dump_structure() {
  # public schema only; strip comments/SET noise, pg_dump's random
  # \restrict tokens, and the migration ledger (prod-only by design).
  pg_dump "$1" \
    --schema-only --schema=public --no-owner --no-acl \
    2>/dev/null \
  | grep -vE '^(--|SET |SELECT pg_catalog\.set_config)' \
  | grep -vE '^\\(un)?restrict ' \
  | sed '/^$/d' \
  | awk '/^CREATE TABLE public\._applied_migrations/,/^\);$/ { next } { print }' \
  | grep -vE '_applied_migrations'
}

dump_privileges() {
  psql "$1" -X -q -v ON_ERROR_STOP=1 -At <<'SQL'
SELECT 'function ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
       || ' anon=' || has_function_privilege('anon', p.oid, 'EXECUTE')::text
       || ' authenticated=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
UNION ALL
SELECT 'table ' || c.relname || ' ' || r.role || '='
       || concat_ws(',',
            CASE WHEN has_table_privilege(r.role, c.oid, 'SELECT') THEN 'select' END,
            CASE WHEN has_table_privilege(r.role, c.oid, 'INSERT') THEN 'insert' END,
            CASE WHEN has_table_privilege(r.role, c.oid, 'UPDATE') THEN 'update' END,
            CASE WHEN has_table_privilege(r.role, c.oid, 'DELETE') THEN 'delete' END)
FROM pg_class c
JOIN pg_namespace n2 ON n2.oid = c.relnamespace
CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(role)
WHERE n2.nspname = 'public' AND c.relkind = 'r' AND c.relname <> '_applied_migrations'
ORDER BY 1;
SQL
}

TMP_A=$(mktemp); TMP_B=$(mktemp); PRIV_A=$(mktemp); PRIV_B=$(mktemp)

echo "Dumping structure: $LABEL_A ..."
dump_structure "$URL_A" > "$TMP_A"
echo "Dumping structure: $LABEL_B ..."
dump_structure "$URL_B" > "$TMP_B"
echo "Dumping privileges ..."
dump_privileges "$URL_A" > "$PRIV_A"
dump_privileges "$URL_B" > "$PRIV_B"

drift=0
echo ""
echo "── Structure ──"
if diff -u --label "$LABEL_A" --label "$LABEL_B" "$TMP_A" "$TMP_B"; then
  echo "identical."
else
  drift=1
fi

echo ""
echo "── Privileges (anon/authenticated) ──"
if diff -u --label "$LABEL_A" --label "$LABEL_B" "$PRIV_A" "$PRIV_B"; then
  echo "identical."
else
  drift=1
fi

echo ""
if [ "$drift" -eq 0 ]; then
  echo "No drift: structure and privileges match."
else
  echo "DRIFT DETECTED (see diffs above)."
  echo "If prod is behind, run: npm run db:migrate"
  echo "If schema.sql is behind, someone hand-edited prod — reconcile and add a migration."
  exit 1
fi
