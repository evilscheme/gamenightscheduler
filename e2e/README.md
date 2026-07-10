# E2E test suite

Playwright specs organized by feature under `tests/`. See CLAUDE.md for the
run commands and the run-individually workflow.

## Test isolation contract

There is deliberately **no between-test database cleanup**. The suite runs
`fullyParallel` with multiple workers against one shared local Supabase, and
isolation rests on two guarantees:

1. **Unique per-test data.** Every seeded user/game/session gets a
   timestamp-unique name and email (see `helpers/seed.ts`). Tests only touch
   what they seeded.
2. **RLS scoping.** A test's user only ever sees its own games and rows, so
   parallel tests can't observe each other's data through the app.

The corollary rule: **never assert on global aggregates** (total user counts,
"exactly N games in the table", etc.) — other workers' data is in there too.
Assert on the presence/shape of the rows YOUR test created, the way
`tests/admin/dashboard.spec.ts` does.

Auth users accumulate across runs; `cleanTestUsers()` in `helpers/seed.ts`
handles those in global teardown.
