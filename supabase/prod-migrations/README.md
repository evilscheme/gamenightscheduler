# Production migrations

Append-only, timestamped SQL files applied to the PRODUCTION database by hand
via `npm run db:migrate` (see `scripts/prod-migrate.sh`). Applied files are
recorded in `public._applied_migrations` on the target database, so the runner
only ever applies what's pending.

This directory is deliberately NOT `supabase/migrations/` — that directory's
single symlinked file applies `schema.sql` wholesale to FRESH databases (CI,
e2e, `db:reset`) and must stay as-is.

## Rules

- **Every `schema.sql` change lands in the same PR as its prod-migration file.**
  `schema.sql` stays the canonical fresh-install artifact; the file here is how
  the same change reaches the already-running production database.
- **Files are immutable once merged.** Fix mistakes with a new file, never by
  editing an applied one.
- **Name format:** `YYYYMMDDTNN_short_description.sql` (lexicographic order is
  application order).
- **Write transactionally and idempotently where cheap** (`BEGIN/COMMIT`,
  `CREATE OR REPLACE`, `DROP ... IF EXISTS`): the runner records success AFTER
  a file applies, so a crash between apply and record means the file may run
  again.
- **Pre-flights live inside the file** as a `DO` block that raises a clear
  error (see `20260709T03_play_days_check.sql`), so a violating database
  fails loudly and rolls back rather than half-applying.
- **New functions follow the grant lockdown discipline** — see
  `docs/security/2026-06-10-open-security-findings.md`.
- The chain starts 2026-07-09 (owner decision: no backfill of earlier
  hand-applied changes).

## Checking for drift

`npm run db:drift` (see `scripts/check-schema-drift.sh`) diffs the public
schema of two databases — by default your local Supabase (freshly
`db:reset`, i.e. pure schema.sql) against prod (`DATABASE_URL`). Run it
periodically or after applying migrations; an empty diff means prod matches
schema.sql.
