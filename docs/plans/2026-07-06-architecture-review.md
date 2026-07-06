# Architecture Review — July 2026

Findings from a full-codebase review (architecture, structure, readability, abstraction,
reuse, internal-design consistency, best practices). This doc is the rationale; the
actionable work items live in `2026-07-06-architecture-remediation-plan.md`.

Line numbers were accurate at review time (commit `0f4738f`) and will drift — treat them
as anchors, and locate code by the named function/pattern.

## Overall assessment

Healthy codebase with strong bones: logic aggressively extracted into pure, tested
modules in `src/lib`; a mature "thin page → hooks → TabContent orchestrator → panels"
pattern on the `games/[id]` route; a real repository-style data layer (`src/lib/data`);
thoughtful security (CSP, RLS with recursion-safe helpers, triple-gated test-auth,
column-freeze triggers). The dominant weakness is **good abstractions that are only
partially adopted**, plus **no type safety at the database boundary**, plus a
**manual production-migration strategy**.

## Findings by theme

### T1. Good abstractions, partially adopted

1. `src/lib/data` bypassed: `DashboardContent.tsx:62-66` hand-writes the games+GM join
   that `fetchUserGmGames` owns; `settings/page.tsx:64-72` re-inlines
   `updateUserProfile` (`src/lib/data/users.ts:3`).
2. `withOptimistic` (`src/hooks/withOptimistic.ts`) used in 1 of ~7 eligible sites
   (`useGameMeta.ts:72`). The same apply→mutate→revert pattern is hand-rolled in
   `useAvailability.ts` (~111-169, ~216-258, ~305-353), `usePlayDates.ts` (~45-73,
   ~85-110), `useSessions.ts` (~104-114).
3. `requireAdmin()` (`src/lib/api/admin.ts:16`) exists but there is no `requireUser()`;
   the same getUser()+401 block is copy-pasted in `api/account/delete`,
   `api/account/delete-preview`, `api/games/invite/[code]`. Those account routes also
   use bare `console.error`+500 instead of `serverError()`/`errorId`
   (`src/lib/apiError.ts`).
4. Admin page (`src/app/admin/page.tsx`, ~800 lines) bypasses the TabContent pattern:
   five tab bodies inlined, each hand-rolling table scaffolding and fetch/loading/error.
5. `AvailabilityCalendar.tsx` hand-rolls two overlays (`NoteEditorPopover` ~:1022,
   GM action menu ~:466) instead of using the shared `Modal` — loses Escape handling
   and body scroll-lock.
6. Browser Supabase client: `AuthContext.tsx:25-32` keeps a deliberate singleton, but
   11 other call sites (hooks `useOtherGameSessions`, `usePlayDates`, `useSessions`,
   `useAvailability`, `useGameMeta`; plus 6 pages/components) each call
   `createClient()` at module scope. Multiple GoTrueClient instances risk token-refresh
   races — the exact failure the AuthContext comment warns about.

### T2. Type system ends at the database

- No Supabase type codegen; queries run against bare `SupabaseClient`, patched by
  hand-written interfaces in `src/types/index.ts` and casts like
  `as unknown as MembershipWithUser[]` (`src/lib/data/memberships.ts:12`).
- API contract types duplicated: `OwnedGame`/`DeletePreview` declared in both
  `api/account/delete-preview/route.ts:5-24` and `settings/delete-account/page.tsx:9-27`;
  `GameWithEngagement` in both `app/admin/page.tsx:40` and `api/admin/games/route.ts:7`.

### T3. Two monoliths

- `src/components/calendar/AvailabilityCalendar.tsx` (1,185 lines): bulk-actions bar,
  month grid, legend, out-of-range toast state machine, two hand-rolled modals, a
  ~140-line inline status→color cascade (~:660-723, :788-802), long-press handling.
- `src/app/admin/page.tsx` (800 lines): see T1.4.

### T4. Fragmented date handling (bugs at two layers)

- Four competing date↔`YYYY-MM-DD` idioms. `toISOString().split('T')[0]` returns UTC
  "today" (wrong near midnight for non-UTC users) at `games/[id]/edit/page.tsx:119`,
  `api/admin/games/route.ts:54`, `topUsers.ts:55`. Correct helpers
  (`toLocalDateString`/`getTodayLocalDate`) exist but are buried in
  `upcomingSessions.ts:19-30`.
- DB layer: sessions insert policy `date >= CURRENT_DATE` and `count_future_sessions`
  evaluate CURRENT_DATE in UTC while games carry their own `timezone` — "tonight" in a
  US timezone can be rejected as past near the UTC day boundary.

### T5. Production DB operations

- `schema.sql` symlink strategy is fine for CI/fresh installs, but prod evolves via
  hand-run ALTERs (`scripts/migrate_user_preferences.sql`) with no history, no drift
  check, no rollback; `deploy.yml` never touches the DB.
- `handle_new_user()` (schema.sql ~158-179) runs AFTER INSERT on auth.users and can
  abort signup entirely if the OAuth name exceeds the 50-char CHECK or the avatar host
  isn't in the allowlist (e.g. legacy `lh4.googleusercontent.com`).
- Account deletion (`api/account/delete/route.ts:146-163`) deletes `public.users` then
  `auth.users`; the FK already cascades from auth.users, so the manual delete is
  redundant and creates the orphan window (auth account survives with no profile).
- Usage caps in RLS `WITH CHECK` are TOCTOU-racy and surface as opaque RLS errors,
  while the 50-player cap inside `join_game_by_invite` raises a friendly typed error —
  same class of limit, two behaviors.
- Missing CHECKs: `available_after < available_until`; `play_days` element range 0-6.

### T6. Confirmed styling bug: `destructive` token doesn't exist

`globals.css` (the only stylesheet) defines `--danger`/`--danger-muted`/
`--danger-foreground` for every theme but never any `destructive` token. 15 usages of
`*-destructive` classes across 7 files are silent no-ops in Tailwind v4 (undefined
token → utility not generated): error text and danger-zone borders render unstyled.
CLAUDE.md documents `destructive` as canonical — the styleguide advertises a
non-existent token. Also: hardcoded `bg-purple-100`/`bg-blue-100` badges at
`admin/page.tsx:585,590`; `help/page.tsx:171-179` uses raw `bg-green-500`/`bg-red-500`/
`bg-yellow-500` for the availability legend, diverging from the themed `cal-*` tokens.

### T7. All-client rendering waterfall

Every page is `'use client'`; `games/[id]/page.tsx` fires four hooks where three gate
on `ready = !!game` — a two-hop waterfall behind one full-page spinner.
`api/admin/games/[id]/route.ts:34-46` proves a one-shot server-side `Promise.all`
fetch is feasible with existing `lib/data` functions. Defensible tradeoff for an
interactive auth-gated app; lowest priority.

### T8. Testing gaps

- Stateful hooks are the untested middle layer (`useAvailability` 375 lines,
  `useSessions`, `usePlayDates`, `useGameMeta`…); only `withOptimistic` and
  `useLocalStoragePref` have tests, despite `renderHook` being available.
- No `tsc --noEmit` anywhere in CI — tests/fixtures/e2e are never typechecked.
- Coverage collected but not gated (no thresholds in `vitest.config.ts`).
- `cleanDatabase()` in `e2e/helpers/seed.ts` is dead code; E2E isolation rests on an
  undocumented "unique data + RLS" convention.
- `makeSuggestion` factory duplicated verbatim in two describe blocks of
  `suggestions.test.ts` (~156-178, ~291-313).

### T9. `src/lib` organization

~40 flat modules. The availability domain spans five sibling files that re-implement
the same "eligible play date" predicate five times with subtly different signatures
(`bulkAvailability.ts:40-63`, `defaultAvailability.ts:53-65`, `copyAvailability.ts:47-63`
and `:116-129`, `availability.ts:53-63`/`:159-169`). Near-duplicate formatters:
`scheduleView.formatTimeWindow` vs `otherGameSessions.formatSessionTimeWindow`.
The dice subsystem (`quat`, `d20Geometry`, `diceConfig`, `dieRenderer`, `dicePhysics`,
`diceTumble`, `critBurst`) is the positive reference: clean layering, lazy-loaded
physics, justified hand-rolled math. Leave it alone.

### Minor (recorded, not all planned)

- `test-auth` route: production-safe triple gate, but copy-pasted verbatim across
  POST/DELETE/PUT handlers; gating silently relies on `next dev` forcing
  `NODE_ENV=development` (playwright.config.ts:96).
- `games/[id]/layout.tsx:13-18` uses the service-role client in `generateMetadata`,
  leaking game names to non-members via `<title>`.
- `is_admin` column grants no DB-level capability (admin power is service-role bypass).
- `idx_availability_user_id` largely redundant with the leading column of
  `UNIQUE(user_id, game_id, date)`.
- `wipe-data.sql`/`wipe-database.ts` omit `user_availability_defaults` and
  `game_play_dates` (rely on CASCADE).
