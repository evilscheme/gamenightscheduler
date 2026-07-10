# Production Migration Strategy — Design Proposal

**Status:** DECIDED and implemented (2026-07-10). Owner's decisions: (1) prod
SQL is committed to `supabase/prod-migrations/`; (2) drift detection is an
on-demand CLI (`npm run db:drift`), not CI; (3) applying is a manually-run,
confirm-gated CLI (`npm run db:migrate`), not CI; (4) no backfill — the chain
starts 2026-07-09 with the three Phase 6 migrations. The runner records
applied files in `public._applied_migrations` (Option B). The chain was
verified equivalent to schema.sql: a pre-Phase-6 database plus the three
migration files produces a byte-identical public schema to a fresh
schema.sql install. The rest of this document is the original proposal, kept
for rationale.

## Problem

`supabase/schema.sql` is the single source of truth for FRESH databases: the
symlinked initial migration applies it wholesale in CI, e2e, and `db:reset`.
Production, however, evolves by hand: someone runs an ALTER in the SQL editor
(kept locally as an uncommitted `docs/migrations/YYYY-MM-DD-*-prod.sql` file,
per the convention in `docs/security/2026-06-10-open-security-findings.md`),
then retro-edits schema.sql to match. Consequences:

- **No history.** There is no committed, ordered record of what has been applied
  to prod or when. The local `docs/migrations/` folder is one laptop away from
  loss and invisible to collaborators.
- **No drift detection.** If a hand-run ALTER is forgotten, mistyped, or
  written differently than the schema.sql edit, prod and schema.sql diverge
  silently — and CI can never catch it because CI always tests the fresh
  end-state.
- **No automation or rollback.** `deploy.yml` ships app code only; the DB step
  is a human with a SQL editor, with nothing forcing app-deploy and DB-change
  ordering.
- **Growing queue.** The remediation plan's Phase 6 items alone produced three
  HUMAN ACTION REQUIRED SQL blocks (see the plan's Work Log) that currently
  exist only as markdown.

## Goals

1. Keep `schema.sql` as the readable, canonical fresh-install artifact (its
   symlink trick and the "no second migration file" CI rule keep working).
2. Give prod changes a committed, ordered, immutable history.
3. Detect drift automatically: fresh(schema.sql) must equal fresh(migration
   chain), and prod must match the chain's head.
4. Automate application so a deploy can't silently outrun its schema change.

## Proposed design

### 1. Committed prod-migration chain, alongside schema.sql

Create `supabase/prod-migrations/` (deliberately NOT `supabase/migrations/`,
which the symlink owns) holding timestamped, immutable files:

```
supabase/prod-migrations/
  20260709T01_handle_new_user_resilience.sql
  20260709T02_game_today_cutoffs.sql
  20260709T03_play_days_check.sql
```

Rules: append-only; every schema.sql edit lands in the same PR as its
prod-migration file (this reverses the current "never committed alongside"
convention — see Decision 1); each file is idempotent where cheap
(`DROP POLICY IF EXISTS`, `CREATE OR REPLACE`) and carries its pre-flight query
as a comment.

### 2. Drift check in CI (the load-bearing piece)

New CI job on every PR touching `supabase/**`:

1. Spin up Postgres (the throwaway-cluster pattern from the remediation Work
   Log works today: initdb + stub auth schema + roles; no Docker needed).
2. Database A: apply `schema.sql`.
3. Database B: apply the previous release's schema baseline + every
   prod-migration in order.
4. Diff A vs B with `migra` (or `pg_dump --schema-only | diff` as the
   zero-dependency fallback). Non-empty diff fails the build with the diff as
   the error message.

This single job converts "schema.sql was retro-edited to match prod" from a
hope into an invariant.

### 3. Applying to prod

Two credible options (Decision 2):

- **Option A — Supabase CLI, linked project.** `supabase db push` from a manual
  `workflow_dispatch` job (mirroring deploy.yml's confirm-gate), using
  `SUPABASE_ACCESS_TOKEN` + `SUPABASE_DB_PASSWORD` secrets. Pros: tracks
  applied-migration state in the project itself. Cons: requires migrating the
  chain into the CLI's expected layout, interacts with the symlink trick, and
  the CLI's state table must be seeded to believe the initial schema is
  already applied.
- **Option B — plain psql runner.** A tiny workflow job that applies any
  not-yet-applied `prod-migrations/*.sql` via `psql $PROD_DATABASE_URL`,
  recording applied filenames in a `public._applied_migrations` table. Pros:
  no CLI state assumptions, trivially auditable, keeps the symlink world
  untouched. Cons: we own ~30 lines of runner script.

Either way the job stays **manually triggered with a typed confirmation**
(matching deploy.yml) — this is a small solo project; unattended DB migration
on merge is more automation than the blast radius warrants today.

### 4. Rollback policy

Forward-only. Each migration file must state (as a header comment) its blast
radius and, where reversible, the compensating SQL. No automatic down
migrations — for this schema (RLS policies, functions, additive columns) a
compensating forward migration is safer than pretending down-scripts stay
correct.

## Decisions needed from the owner

1. **Commit prod SQL to the repo?** This design says yes (reversing the current
   local-only convention and the CLAUDE.md note that prod migration files are
   "never committed"). If the concern was CI breakage, `supabase/prod-migrations/`
   avoids it — only `supabase/migrations/` is auto-applied. If the concern was
   something else (e.g. not wanting schema internals public), Option B can read
   from a private location instead, at the cost of goal 2.
2. **Option A (supabase db push) vs Option B (psql runner)?** Recommendation:
   **B** — it composes with the existing symlink strategy instead of fighting
   it, and the state table makes "what has prod received?" a one-query answer.
3. **Secrets:** which of `SUPABASE_ACCESS_TOKEN` / `SUPABASE_DB_PASSWORD` /
   `PROD_DATABASE_URL` may live in GitHub Actions secrets? (db:backup already
   implies a DATABASE_URL exists locally.)
4. **Baseline bootstrap:** pick the commit that matches current prod (after
   applying the three pending Phase 6 blocks) and tag it as the chain's
   baseline; the drift check diffs against that tag going forward.
5. **Backfill or start fresh?** The historical hand-applied changes
   (quick-wins, function lockdowns, user-preferences) can be reconstructed
   into the chain for completeness, or the chain can simply start at the new
   baseline. Recommendation: start at the baseline; reconstruct only if
   auditability of the past matters.

## Migration path (once decisions land)

1. Apply the three pending HUMAN ACTION REQUIRED blocks from the remediation
   plan's Work Log to prod by hand (last hurrah of the old workflow), saving
   them as the first files in `supabase/prod-migrations/`.
2. Land the drift-check CI job; confirm it passes on the baseline.
3. Land the apply-workflow (Option A or B).
4. Update CLAUDE.md's migration guidance and the security doc's progress-log
   convention to point at the new flow.
