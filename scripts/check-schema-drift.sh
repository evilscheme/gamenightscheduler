#!/bin/bash
#
# Compare supabase/schema.sql against a live database (default: PROD).
#
# Default mode builds a THROWAWAY reference database from schema.sql on the
# local Supabase cluster (uniquely named per invocation; only that database is
# dropped afterwards) — the reference is always exactly schema.sql, never a
# possibly-stale dev database — then compares two things:
#   1. Structure: pg_dump --schema-only --schema=public, normalized.
#   2. Privileges: for anon/authenticated/service_role — schema USAGE/CREATE,
#      all seven table privileges (incl. TRUNCATE/REFERENCES/TRIGGER),
#      sequence privileges, and function EXECUTE, via catalog queries (the
#      structural dump deliberately omits ACLs, and this app's security
#      posture depends on function grant lockdown).
#      NOT covered: object ownership and default privileges (pg_default_acl) —
#      owners legitimately differ between local and hosted Supabase, and
#      default ACLs only affect future objects, whose actual privileges this
#      check catches once they exist.
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
TEMP_DB="_drift_ref_$$_${RANDOM}"

cleanup() {
  if [ "${BUILT_REF:-}" = "1" ]; then
    # Only ever drops the uniquely-named database THIS invocation created.
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

  echo "Building reference database from supabase/schema.sql ($TEMP_DB) ..."
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
WITH roles(role) AS (VALUES ('anon'), ('authenticated'), ('service_role'))
SELECT 'schema public ' || role || '='
       || concat_ws(',',
            CASE WHEN has_schema_privilege(role, 'public', 'USAGE') THEN 'usage' END,
            CASE WHEN has_schema_privilege(role, 'public', 'CREATE') THEN 'create' END)
FROM roles
UNION ALL
SELECT 'function ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') ' || r.role
       || '=' || CASE WHEN has_function_privilege(r.role, p.oid, 'EXECUTE') THEN 'execute' ELSE '-' END
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN roles r
WHERE n.nspname = 'public'
UNION ALL
SELECT 'table ' || c.relname || ' ' || r.role || '='
       || concat_ws(',',
            CASE WHEN has_table_privilege(r.role, c.oid, 'SELECT') THEN 'select' END,
            CASE WHEN has_table_privilege(r.role, c.oid, 'INSERT') THEN 'insert' END,
            CASE WHEN has_table_privilege(r.role, c.oid, 'UPDATE') THEN 'update' END,
            CASE WHEN has_table_privilege(r.role, c.oid, 'DELETE') THEN 'delete' END,
            CASE WHEN has_table_privilege(r.role, c.oid, 'TRUNCATE') THEN 'truncate' END,
            CASE WHEN has_table_privilege(r.role, c.oid, 'REFERENCES') THEN 'references' END,
            CASE WHEN has_table_privilege(r.role, c.oid, 'TRIGGER') THEN 'trigger' END)
FROM pg_class c
JOIN pg_namespace n2 ON n2.oid = c.relnamespace
CROSS JOIN roles r
WHERE n2.nspname = 'public' AND c.relkind = 'r' AND c.relname <> '_applied_migrations'
UNION ALL
SELECT 'sequence ' || c.relname || ' ' || r.role || '='
       || concat_ws(',',
            CASE WHEN has_sequence_privilege(r.role, c.oid, 'USAGE') THEN 'usage' END,
            CASE WHEN has_sequence_privilege(r.role, c.oid, 'SELECT') THEN 'select' END,
            CASE WHEN has_sequence_privilege(r.role, c.oid, 'UPDATE') THEN 'update' END)
FROM pg_class c
JOIN pg_namespace n3 ON n3.oid = c.relnamespace
CROSS JOIN roles r
WHERE n3.nspname = 'public' AND c.relkind = 'S'
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
echo "── Structure (public schema, ownership/ACLs excluded) ──"
if diff -u --label "$LABEL_A" --label "$LABEL_B" "$TMP_A" "$TMP_B"; then
  echo "identical."
else
  drift=1
fi

echo ""
echo "── Privileges (anon/authenticated/service_role: schema, tables, sequences, functions) ──"
if diff -u --label "$LABEL_A" --label "$LABEL_B" "$PRIV_A" "$PRIV_B"; then
  echo "identical."
else
  drift=1
fi

echo ""
if [ "$drift" -eq 0 ]; then
  echo "No drift within the compared surface (structure + role privileges above;"
  echo "ownership and default ACLs are not compared — see header comment)."
else
  echo "DRIFT DETECTED (see diffs above)."
  echo "If prod is behind, run: npm run db:migrate"
  echo "If schema.sql is behind, someone hand-edited prod — reconcile and add a migration."
  exit 1
fi
