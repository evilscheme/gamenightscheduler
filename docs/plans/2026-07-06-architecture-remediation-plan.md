# Architecture Remediation Implementation Plan

> **For Claude:** Execute this plan one work item at a time via the **Loop Protocol**
> section at the bottom. Read **Ground Rules** before every item. Do not skip ahead,
> and do not batch multiple items into one iteration.

**Goal:** Every work item below is either `[x]` (done, Definition of Done verified) or
`[B]` (blocked, with an actionable reason in the Work Log). Lint, typecheck, and the
unit suite pass on the branch after every commit.

**Rationale / evidence:** `docs/plans/2026-07-06-architecture-review.md` (theme numbers
T1–T9 referenced below).

**Baseline commit at planning time:** `0f4738f`. **Post-G1 baseline:** `560a222`
(PRs #132 and #133 merged into this branch on 2026-07-09; anchors in the revised
`[G1]` items reflect that). Cited line numbers are anchors, not gospel — locate code
by function/pattern name if lines have drifted.

---

## Ground Rules

1. **Branch & commits.** Work on the branch designated for your session (fallback:
   create `feat/arch-remediation` from `origin/main`). One work item per commit,
   commit message prefixed with the item ID, e.g. `P1.2: centralize local-date helpers`.
   Push after every item with `git push -u origin <branch>`. Never force-push, never
   rewrite history, never merge to main, never open a PR unless the human asks.
2. **Schema changes** (Phase 6 only): modify `supabase/schema.sql` directly. **NEVER**
   add files to `supabase/migrations/` (the initial migration is a symlink to
   schema.sql; a second file breaks CI with "already exists" errors). For each schema
   item, write the prod-apply SQL (idempotent `ALTER`/`CREATE OR REPLACE`) into the
   Work Log entry as a fenced SQL block tagged **HUMAN ACTION REQUIRED** — do not
   commit it as a migration file, and never run any SQL against a remote database.
   Title the SQL block with the repo's existing (uncommitted, local-only) naming
   convention `docs/migrations/YYYY-MM-DD-<item>-prod.sql` — see the progress log in
   `docs/security/2026-06-10-open-security-findings.md` — so the human can save and
   apply it the way previous prod migrations were handled.
3. **Styling:** semantic theme classes only (`primary`, `danger`, `muted`, `accent`,
   `card`, `foreground`, `border`, `ring`, `cal-*`, …). No hardcoded palette classes
   (`bg-blue-500` etc.). Check both desktop and mobile rendering for UI changes.
4. **Tests:** per CLAUDE.md, every behavior change needs tests (unit for `src/lib`
   logic, e2e for user-facing flows). Pure styling/config changes are exempt.
5. **Verification baseline** for every item (after P0.1 exists):
   `npm run lint && npm run typecheck && npm run test:run`.
   For items marked **[e2e]**: if local Supabase starts in your environment
   (`npm run db:start`), run the named spec(s) with
   `npx playwright test <spec> --project=chromium`. If the environment cannot run
   local Supabase, record "e2e deferred: <spec names>" in the Work Log — that alone
   does NOT block the item.
6. **No scope creep.** If you notice an unrelated problem, add one line under
   **Discovered Work** at the bottom; do not fix it in the current item.
7. **Behavior preservation.** Unless an item explicitly says it fixes a bug, refactors
   must be behavior-neutral. When refactoring tested code, existing tests must pass
   unmodified (or with mechanical import-path updates only).

## Status legend

`[ ]` not started · `[x]` done and verified · `[B]` blocked (reason in Work Log) ·
`[S]` split (replaced by sub-items added directly below it) ·
`[D]` dropped by owner decision (do not implement)

Items whose **title contains `[G1]`** are gated: do not start them until Gate G1
below is `[x]`.

---

## Gate G1 `[x]` — Merge PR #133 and revise this plan (blocks all `[G1]`-tagged items)

**EXECUTED 2026-07-09** (see Work Log). Main was merged in at `560a222` — which also
brought in PR #132 (SECURITY DEFINER function-grant lockdown, a schema.sql change).
All `[G1]`-tagged items below were revised against the post-merge code and are now
unblocked. The original gate instructions are kept below for the record.

**Context:** PR #133 ("Restructure client data fetching: React Query cache, parallel
dashboard fetch, batched bulk availability") rewrites the game-page hooks
(`useGameMeta`, `useAvailability`, `useSessions`, `usePlayDates`,
`useOtherGameSessions`) around TanStack Query v5 with a central key registry
(`src/lib/queryKeys.ts`), adds `src/lib/dashboardData.ts` (parallel dashboard fetch),
batches bulk availability through a required `onBulkSet` prop, and touches
`AuthContext`, `DashboardContent`, `AvailabilityCalendar`, `lib/data/games.ts`,
`lib/data/memberships.ts`, `Providers.tsx`, and `CLAUDE.md`. It contains **no schema
changes** — Phase 6 is unaffected.

**Eligibility:** this item may only be worked when #133 has landed on main. Check
with `git fetch origin main && git log origin/main --oneline -15` — if the #133
merge is not present, skip this item AND every `[G1]`-tagged item this iteration.
Untagged items may proceed in the meantime (note: `games/[id]/edit/page.tsx`,
settings pages, and CLAUDE.md are touched by both #133 and untagged items P1.1/P1.2
— expect small, trivially resolvable merge conflicts there).

**When eligible, do:**
1. `git merge origin/main` into the working branch; resolve conflicts; run the full
   baseline verification (lint, typecheck, unit).
2. Revise the affected items IN THIS FILE before doing any of them:
   - **P3.1–P3.3:** the `withOptimistic` standardization is superseded — the app's
     mutation standard is now TanStack Query optimistic cache writes + rollback +
     invalidation via `queryKeys.ts`. Rewrite these items as: renderHook
     characterization tests for the NEW hooks (wrap in `QueryClientProvider`);
     verify every mutation follows the optimistic-write/rollback/invalidation
     pattern; delete `withOptimistic` if nothing imports it anymore.
   - **P1.3:** re-locate the module-scope `createClient()` call sites — the hooks and
     AuthContext were rewritten; the singleton work may be partially done or moved.
   - **P2.2:** DashboardContent's inline query likely moved into
     `src/lib/dashboardData.ts` — re-verify each bypass still exists before fixing.
   - **P5.2 / P5.3:** refresh AvailabilityCalendar line anchors and scope (its bulk
     path changed).
   - **P7.2:** include `queryKeys.ts` and `dashboardData.ts` in the lib clustering.
   - Review doc T7 (client fetch waterfall): largely addressed by #133 — verify and
     add a note there.
3. Record the revision as a `G1` Work Log entry; flip this gate to `[x]`.

---

## Phase 0 — CI guardrails (do first; protects everything after)

### P0.1 `[x]` Add a typecheck script and CI step
- **Files:** `package.json`, `.github/workflows/ci.yml`
- **Do:** Add `"typecheck": "tsc --noEmit"` to package.json scripts. Run it. Fix any
  pre-existing errors it reveals (record the count and nature in the Work Log — if a
  fix is non-trivial/behavioral, mark that error site with a targeted
  `// @ts-expect-error TODO(P0.1)` and add it to Discovered Work instead). Add a
  `Typecheck` step to `ci.yml` between Lint and Unit Tests: `run: npm run typecheck`.
- **Done when:** `npm run typecheck` exits 0; ci.yml contains the step; lint and unit
  tests pass.

### P0.2 `[D]` ~~Gate coverage with thresholds~~ — DROPPED (owner decision, 2026-07-08)
- Coverage metrics have never worked reliably in this codebase (the React/client
  architecture produces misleading numbers). Do NOT add coverage thresholds or gate
  CI on coverage. `npm run test:coverage` remains available for local inspection
  only. The "tests required" rule is enforced by review, not by a coverage gate.

## Phase 1 — Confirmed bug fixes (independent; small)

### P1.1 `[ ]` Fix the nonexistent `destructive` token + hardcoded colors (T6)
- **Files:** all 7 files matching `grep -rln "destructive" src --include="*.tsx"`
  (currently: `components/admin/EngagementCharts.tsx`,
  `components/games/schedule/SessionDetailsModal.tsx`, `app/admin/page.tsx`,
  `app/settings/page.tsx`, `app/settings/delete-account/page.tsx`,
  `app/dev-login/client.tsx`, `app/games/[id]/edit/page.tsx`); also `CLAUDE.md`,
  `app/help/page.tsx`.
- **Do:** `globals.css` defines `--danger`, `--danger-muted`, `--danger-foreground`
  but no `destructive` token, so every `*-destructive` class is a silent no-op in
  Tailwind v4. Replace each with the `danger` equivalent
  (`text-destructive`→`text-danger`, `border-destructive`→`border-danger`,
  `ring-destructive`→`ring-danger`, `destructive-foreground`→`danger-foreground`,
  opacity modifiers preserved, e.g. `border-destructive/30`→`border-danger/30`).
  In CLAUDE.md's Styling section, replace `destructive` in the semantic-class list
  with `danger` (and mention `danger-muted`). Then fix the raw-palette violations:
  Admin/GM badges at `app/admin/page.tsx:585,590` (`bg-purple-100…`/`bg-blue-100…`)
  → semantic badge styles (e.g. `bg-primary/10 text-primary` for one role and
  `bg-accent/10 text-accent-foreground` or similar distinct semantic pairing for the
  other); availability legend at `app/help/page.tsx:171-179`
  (`bg-green-500`/`bg-red-500`/`bg-yellow-500`) → the same `cal-available-bg`/
  `cal-unavailable-bg`/`cal-maybe-bg` tokens the calendar itself uses (check
  `globals.css` for exact names).
- **Tests:** styling-only — no new tests required. Visually verify via
  `npm run dev:local` + dev-login if the environment allows; otherwise note it.
- **Done when:** `grep -rn "destructive" src --include="*.tsx"` returns nothing;
  `grep -rnE "bg-(purple|blue|green|red|yellow)-[0-9]" src/app/admin/page.tsx src/app/help/page.tsx`
  returns nothing; lint/typecheck/unit pass.

### P1.2 `[ ]` Centralize local-date helpers; fix UTC-today bugs (T4 app layer)
- **Files:** new `src/lib/date.ts` + `src/lib/date.test.ts`;
  `src/lib/upcomingSessions.ts`; `src/lib/timezone.ts` (~:191-193);
  `src/app/games/[id]/edit/page.tsx:119`; `src/app/api/admin/games/route.ts:54`;
  `src/lib/topUsers.ts:55`.
- **Do:** Move `toLocalDateString` and `getTodayLocalDate` from
  `upcomingSessions.ts:19-30` into new `src/lib/date.ts`; have upcomingSessions
  import them (keep re-exports there only if other files already import from it —
  prefer updating importers). Replace the duplicated inline `getFullYear/padStart`
  formatting in `timezone.ts` (~:191-193) with `toLocalDateString`. Replace all three
  `new Date().toISOString().split('T')[0]` sites with `getTodayLocalDate()` — this is
  the bug fix: `toISOString()` yields UTC "today", wrong near midnight for non-UTC
  users. Note: `topUsers.ts:55` has an `opts.today ??` injection — keep it, only
  change the fallback.
- **Tests:** unit tests for `date.ts`: known Date → string; and a UTC-vs-local proof
  (e.g. `new Date('2026-01-01T00:30:00')` constructed in a mocked non-UTC TZ via
  `vi.stubEnv`/explicit Date components — at minimum assert
  `toLocalDateString(new Date(2026, 0, 1, 0, 30))` is `'2026-01-01'` regardless of
  what `toISOString()` would say).
- **Done when:** `grep -rn "toISOString().split" src | grep -v test` returns nothing;
  all existing upcomingSessions/timezone/topUsers tests pass unmodified (import paths
  aside); new tests pass.

### P1.3 `[ ]` **[G1]** Single browser Supabase client (T1.6)
- **Files (re-verified post-#133):** `src/lib/supabase/client.ts`, plus 12 call
  sites: module-scope `const supabase = createClient()` in 5 hooks
  (`useAvailability.ts:32`, `useGameMeta.ts:6`, `useSessions.ts:15`,
  `usePlayDates.ts:14`, `useOtherGameSessions.ts:12`) and
  `DefaultAvailabilityEditor.tsx:15`; **per-render** `createClient()` inside
  component bodies (worse — a new client every render) in
  `DashboardContent.tsx:21`, `settings/page.tsx:23`, `games/new/page.tsx:34`,
  `games/[id]/edit/page.tsx:55`, `games/join/[code]/page.tsx:31`; and
  `AuthContext.tsx:30`'s own lazy singleton. Re-run
  `grep -rn "= createClient()" src --include="*.ts*" | grep -v supabase/ | grep -v test`
  before starting.
- **Do:** In `client.ts`, add a module-level memoized accessor:
  `let client: ... | null = null; export function getSupabaseClient() { if (!client) client = createClient(); return client; }`
  Keep `createClient` exported (tests may use it) but switch every module-scope
  `const supabase = createClient()` call site — hooks, pages, components, and
  AuthContext's own singleton logic (`AuthContext.tsx:30`) — to
  `getSupabaseClient()`. Rationale: multiple GoTrueClient instances race on token
  refresh; AuthContext already documents this.
- **Tests:** small unit test: two `getSupabaseClient()` calls return the same
  reference. (`createBrowserClient` needs `NEXT_PUBLIC_*` env — the vitest setup
  already provides or can stub them; see existing patterns in `src/test/`.)
- **Done when:** `grep -rn "createClient()" src --include="*.ts*" | grep -v supabase/ | grep -v test`
  shows no browser-client construction outside `src/lib/supabase/`; lint/typecheck/
  unit pass; **[e2e]** smoke: any one auth-dependent spec, e.g.
  `e2e/tests/dashboard`.

### P1.4 `[ ]` Account deletion: drop redundant delete, close orphan window (T5)
- **Files:** `src/app/api/account/delete/route.ts` (~:146-163).
- **Do:** `public.users.id` has `REFERENCES auth.users(id) ON DELETE CASCADE`, so the
  route's manual `public.users` delete before the `auth.users` delete is redundant —
  and it's what creates the "profile gone but auth account alive" window if step 2
  fails. Reorder to: process transfers → delete `auth.users` (admin client
  `auth.admin.deleteUser`) → done (FK cascades the profile and everything under it).
  Remove the now-dead manual delete and update the failure logging accordingly.
- **Tests:** **[e2e]** `e2e/tests/settings/delete-account.spec.ts` must pass. If any
  unit test covers the route's logic (check `src/lib/api/` and nearby), update it.
- **Done when:** route no longer touches `public.users` directly; e2e spec passes
  (or deferred-noted per Ground Rule 5); lint/typecheck/unit pass.

## Phase 2 — Consistency: API guards, data layer, lint enforcement (T1)

### P2.1 `[ ]` Shared `requireUser()` + uniform error handling in account routes
- **Files:** new `src/lib/api/auth.ts` (+ test), `src/app/api/account/delete/route.ts`,
  `src/app/api/account/delete-preview/route.ts`,
  `src/app/api/games/invite/[code]/route.ts`.
- **Do:** Mirror `requireAdmin`'s return-union pattern (`src/lib/api/admin.ts:16` —
  read it first and copy its shape/test style from `admin.test.ts`) into a
  `requireUser(request)` that returns `{ user }` or a 401 `NextResponse`. Replace the
  three copy-pasted getUser()+401 blocks. Convert the account routes' bare
  `console.error` + 500 responses to the `serverError()`/`errorId` helpers in
  `src/lib/apiError.ts`, matching how the admin routes do it.
- **Tests:** unit tests for `requireUser` mirroring `src/lib/api/admin.test.ts`.
- **Done when:** no route under `src/app/api` contains an inline getUser()+401 block
  (grep for `auth.getUser` in `src/app/api` — hits should be inside the shared
  helpers or test-auth only); lint/typecheck/unit pass; **[e2e]**
  `e2e/tests/settings/delete-account.spec.ts`.

### P2.2 `[ ]` **[G1]** Route data-layer bypasses through `src/lib/data`
- **Files (re-verified post-#133):** `src/app/settings/page.tsx` only — the
  DashboardContent bypass was resolved by #133 (`src/lib/dashboardData.ts` now
  composes `lib/data` functions; DashboardContent has zero inline queries).
- **Do:** Replace `settings/page.tsx`'s inline `users` update (its one remaining
  `.from(` call) with `updateUserProfile` (`src/lib/data/users.ts:3`). Then sweep
  `grep -rn "\.from(" src/components src/app --include="*.tsx"` for any other
  stragglers outside `src/app/api` and fix them the same way (add a properly named
  `lib/data` function if no existing one matches; unit-test it following
  `src/lib/data/sessions.test.ts` conventions).
- **Done when:** the sweep grep returns nothing outside `src/app/api`;
  lint/typecheck/unit pass.

### P2.3 `[ ]` ESLint rule: no raw Supabase queries outside the data layer
- **Files:** `eslint.config.mjs`.
- **Do:** Add a `no-restricted-syntax` rule (or `no-restricted-imports` for
  `@/lib/supabase/admin`) that flags `supabase.from(...)`-style member calls in
  `src/components/**` and `src/app/**` pages, with overrides allowing
  `src/lib/data/**`, `src/lib/api/**`, `src/app/api/**`, `src/app/auth/**`, and test
  files. A pragmatic selector:
  `CallExpression[callee.property.name='from'][callee.object.name=/supabase|client/]`
  — tune against false positives (e.g. `Array.from` has a different callee shape, but
  verify). Severity `error`. If P2.2 isn't done yet, do it first (this rule depends
  on those cleanups).
- **Tests:** none (config). Temporarily add a violation locally to confirm the rule
  fires, then remove it (do not commit the violation).
- **Done when:** `npm run lint` passes on the clean tree and fails on a deliberate
  violation (verified locally, noted in Work Log).

### P2.4 `[ ]` test-auth route: extract the shared gate
- **Files:** `src/app/api/test-auth/route.ts`.
- **Do:** The triple gate (NODE_ENV === 'development' + `isLocalSupabase()` + secret
  header) is copy-pasted into POST (~:41-48), DELETE (~:193-199), PUT (~:247-253).
  Extract one `assertTestEnv(request): NextResponse | null` helper used by all three.
  Add a comment noting the deliberate coupling: e2e runs against `next dev`, which
  forces NODE_ENV to 'development' (see playwright.config.ts:96) — do not "fix" the
  gate to accept NODE_ENV === 'test'.
- **Tests:** **[e2e]** `e2e/tests/api/test-auth-security.spec.ts` must pass.
- **Done when:** one gate implementation; e2e security spec passes (or deferred-noted);
  lint/typecheck/unit pass.

## Phase 3 — Hook tests + mutation-pattern consistency (T1.2, T8) — revised at G1

PR #133 rewrote the game-page hooks around TanStack Query v5. The app's mutation
standard is now: optimistic `queryClient.setQueryData` writes with surgical rollback,
then invalidation of every other cached view the data appears in, with ALL keys built
via `src/lib/queryKeys.ts`. This is documented in CLAUDE.md's "Data Fetching &
Caching" section — read it first; it is the authority these items enforce.
Order matters: characterization tests land BEFORE any refactor they protect.

### P3.1 `[ ]` **[G1]** renderHook tests for the new React Query `useAvailability`
- **Files:** new `src/hooks/useAvailability.test.tsx`.
- **Do:** Using `renderHook` from `@testing-library/react` (setup conventions in
  `src/hooks/useLocalStoragePref.test.ts`), wrap the hook in a fresh
  `QueryClientProvider` per test (new `QueryClient` with `retry: false`). Mock the
  Supabase client at the module boundary (`vi.mock('@/lib/supabase/client')`; after
  P1.3 there is a single `getSupabaseClient` to stub). Cover, for the single-date,
  note/time, and `bulkSetStatus` mutation paths: (a) optimistic cache write applied
  synchronously (`setQueryData`), (b) state retained on success, (c) rollback AND
  refetch on error (the hook reverts and invalidates —
  `useAvailability.ts:133,183-184`), (d) `bulkSetStatus` issues ONE
  `batchUpsertAvailability` call for N dates, (e) invalidations use keys from
  `queryKeys.ts`, never inline arrays.
- **Done when:** the new tests pass and meaningfully assert rollback-on-error for all
  mutation paths; existing suite unaffected.

### P3.2 `[ ]` **[G1]** Retire `withOptimistic`: migrate `useGameMeta`'s last use to the React Query pattern
- **Files:** `src/hooks/useGameMeta.ts` (withOptimistic call at ~:90),
  `src/hooks/withOptimistic.ts` + `withOptimistic.test.ts` (delete at the end).
- **Do:** `useGameMeta` is now a hybrid: React Query for reads, but one mutation
  still routed through the pre-#133 `withOptimistic` helper. Convert that mutation
  to the standard pattern (optimistic `setQueryData` against its `queryKeys` key,
  rollback on error, invalidate affected views — mirror how `useAvailability` and
  `usePlayDates` do it post-#133). Then confirm `withOptimistic` has zero importers
  (`grep -rln withOptimistic src | grep -v withOptimistic.`) and delete the helper
  and its test — the React Query pattern supersedes it entirely.
- **Tests:** renderHook coverage for the migrated `useGameMeta` mutation (same
  harness as P3.1): optimistic apply, success, rollback-on-error.
- **Done when:** `withOptimistic.ts` is deleted with no dangling imports; the new
  useGameMeta test passes; lint/typecheck/unit pass; **[e2e]** `e2e/tests/overview`
  or the game-detail specs.

### P3.3 `[ ]` **[G1]** renderHook tests for `usePlayDates` + `useSessions`; verify pattern consistency
- **Files:** new tests for `src/hooks/usePlayDates.ts` and `src/hooks/useSessions.ts`.
- **Do:** Same harness as P3.1 (QueryClientProvider wrapper, mocked client). For each
  mutation in both hooks, test optimistic apply / success / rollback-on-error, and
  verify it follows the CLAUDE.md standard: optimistic cache write, rollback,
  invalidation of every other view the data appears in (e.g. session changes must
  invalidate the dashboard key), all keys via `queryKeys.ts`. Where a mutation
  deviates from the standard, fix it (that is a bug fix, not a refactor — note it in
  the Work Log).
- **Done when:** tests exist and pass for both hooks; every mutation in `src/hooks/`
  follows the standard pattern; **[e2e]** `e2e/tests/scheduling`.

## Phase 4 — Type safety at the DB boundary (T2)

### P4.1 `[ ]` Generate Supabase types and thread `Database` through clients
- **Files:** new `src/types/database.ts` (generated), `package.json` (script),
  `src/lib/supabase/client.ts`, `server.ts`, `admin.ts`, `src/lib/data/*`.
- **Do:** Attempt `npx supabase gen types typescript --local > src/types/database.ts`
  (requires `npm run db:start`). If the CLI/docker is unavailable in this
  environment, mark `[B]` with the exact command for the human to run — subsequent
  items do not depend on this. On success: add npm script
  `"db:types": "supabase gen types typescript --local > src/types/database.ts"`,
  type all three client factories with `<Database>`, add `SupabaseClient<Database>`
  to `lib/data` function signatures, and remove every `as unknown as` cast that the
  generated types make unnecessary (grep `as unknown as` in `src/lib/data` and
  `src/app/api`). Keep `src/types/index.ts` as the app-level (view-model) types; do
  not try to delete it in this item.
- **Done when:** typecheck passes with `<Database>` threaded through;
  `grep -rn "as unknown as" src/lib/data src/app/api` count is reduced and each
  survivor has a one-line justification comment; lint/unit pass.

### P4.2 `[ ]` Single-source the API contract types
- **Files:** `src/app/api/account/delete-preview/route.ts`,
  `src/app/settings/delete-account/page.tsx` (~:9-27),
  `src/app/api/admin/games/route.ts` (~:7), `src/app/admin/page.tsx` (~:40).
- **Do:** The route files already export their response types
  (`OwnedGame`, `OwnedGameMember`, `PlayerMembershipGame`, `DeletePreview`,
  `GameWithEngagement`). Delete the verbatim re-declarations on the client side and
  replace with `import type { ... } from '@/app/api/...'` (type-only imports from
  route modules are safe — verify the client bundle stays clean via `npm run build`).
  If importing from a route file feels fragile, hoist the shared shapes to
  `src/types/api.ts` and have BOTH sides import from there (preferred if any
  non-type export would get pulled in).
- **Done when:** each contract type has exactly one declaration
  (`grep -rn "interface OwnedGame\|type OwnedGame\|GameWithEngagement" src` shows one
  definition site per type); build passes; lint/typecheck/unit pass.

## Phase 5 — Component decomposition (T3, T1.4, T1.5)

### P5.1 `[ ]` Shared `PageLoading` / `PageError` primitives
- **Files:** new `src/components/ui/PageState.tsx` (or two files, match `ui/`
  conventions), ~18 call sites (grep
  `min-h-\[calc(100vh-4rem)\].*items-center` across `src/app` and `src/components`).
- **Do:** Extract the repeated full-page
  `<div className="min-h-[calc(100vh-4rem)] flex items-center justify-center"><LoadingSpinner size="lg"/></div>`
  block into `<PageLoading/>`; add a matching `<PageError message/action>` for the
  ad-hoc error divs where the pattern is close enough (don't force it — convert only
  clear matches). Replace call sites.
- **Tests:** one small RTL test for each primitive (see existing `.test.tsx` files
  for conventions).
- **Done when:** the duplicated block appears 0 times outside the primitive
  (re-run the grep); lint/typecheck/unit pass.

### P5.2 `[ ]` **[G1]** Extract pure `calendarCellState` from AvailabilityCalendar
- **Files:** new `src/lib/calendarCellState.ts` + test;
  `src/components/calendar/AvailabilityCalendar.tsx` (post-#133 anchors: the
  `bgColor`/`textColor` cascade starts ~:652 inside `MonthCalendar` (function at
  ~:527); the `data-status` derivation is further down the same cell JSX).
- **Do:** The MonthCalendar cell renderer computes a ~140-line status→
  `bgColor`/`textColor` cascade plus a `data-status` derivation inline in JSX. Extract
  a pure function `(inputs: {date, availability, isPlayDay, isSpecialDate, isPast,
  isConfirmedSession, isToday, ...}) → { classes, dataStatus }` — read the JSX
  carefully to enumerate the actual inputs; preserve output classes byte-for-byte.
- **Tests:** unit tests covering every status branch (use the extracted function's
  branches as the checklist); assert exact class strings so behavior is pinned.
- **Done when:** the calendar renders from the pure function; new tests cover all
  branches; **[e2e]** `e2e/tests/availability` passes; lint/typecheck/unit pass.

### P5.3 `[ ]` **[G1]** Split AvailabilityCalendar into components + shared Modal
- **Files:** `src/components/calendar/` — new `MonthCalendar.tsx`,
  `CalendarLegend.tsx`, `NoteEditorPopover.tsx`, `DateActionMenu.tsx`; new
  `src/hooks/useLongPress.ts`; slim `AvailabilityCalendar.tsx`.
- **Do:** Depends on P5.2. Post-#133 the file is 1,177 lines and the bulk-actions
  bar flows through the required `onBulkSet` prop (:73, :96, :257) — preserve that
  contract exactly. Move: bulk-actions/copy bar (may stay in the orchestrator
  or extract `BulkActionsBar.tsx` — judge by size), month grid → `MonthCalendar`
  (function at ~:527), legend (~:351) → `CalendarLegend`, note editor (overlay at
  ~:1015) → `NoteEditorPopover`, GM action menu (overlay at ~:459) →
  `DateActionMenu`, long-press touch handling (~:558-591) → `useLongPress`.
  Convert both overlays to render
  through the shared `src/components/ui/Modal` (gaining Escape-to-close and body
  scroll-lock — this is a small intended behavior improvement, note it in the
  commit). Orchestrator target: under ~300 lines. Keep prop names stable where
  possible to minimize diff noise in `AvailabilityTabContent`.
- **Tests:** existing unit suite + **[e2e]** full `e2e/tests/availability` directory;
  mobile + desktop visual check via dev-login if environment allows.
- **Done when:** `wc -l` on AvailabilityCalendar.tsx ≤ ~300; no
  `fixed inset-0` hand-rolled overlay remains in `src/components/calendar/`
  (grep); e2e availability specs pass (or deferred-noted); lint/typecheck/unit pass.

### P5.4 `[ ]` Refactor admin page to the TabContent pattern
- **Files:** `src/app/admin/page.tsx`; new files under `src/components/admin/`
  (`OverviewTab.tsx`, `GamesTab.tsx`, `TopUsersTab.tsx`, `ActivityTab.tsx`,
  `UpcomingGamesTab.tsx`, `AdminTable.tsx`); optionally new
  `src/hooks/useAdminResource.ts`.
- **Do:** Extract the five inline tab components (currently ~:171, :218, :433, :555,
  :654) into their own files, following the structure of
  `src/components/games/overview/OverviewTabContent.tsx`. Factor the repeated
  `<table>` scaffolding (header row styling, sortable headers, empty/loading rows)
  into a shared `AdminTable` and the repeated fetch/loading/error triad (e.g.
  UpcomingGamesTab ~:661-708) into a small `useAdminResource(url)` hook. Keep
  `StatCard`/`SortableHeader`/`UserCell` wherever they're shared. Behavior-neutral.
- **Tests:** if `useAdminResource` is created, unit-test it; **[e2e]**
  `e2e/tests/admin` directory.
- **Done when:** `admin/page.tsx` is a thin shell (~≤150 lines: auth gate + tab
  switcher); e2e admin specs pass (or deferred-noted); lint/typecheck/unit pass.

## Phase 6 — Database schema fixes (T4 DB layer, T5) — **all HUMAN-GATED for prod**

Every item here: edit `supabase/schema.sql` only (Ground Rule 2); verify with
`npm run db:reset` + targeted e2e if the environment supports local Supabase,
otherwise verify by careful SQL review + typecheck and note the deferral; put the
idempotent prod-apply SQL in the Work Log entry tagged **HUMAN ACTION REQUIRED**.

**Before starting any Phase 6 item, read
`docs/security/2026-06-10-open-security-findings.md`.** It is the live security
backlog: PR #132 added a REVOKE/GRANT block to schema.sql (anchors shifted ~12
lines), it prescribes the `return=minimal` discipline for RLS regression tests, any
new function you add must follow the same grant lockdown pattern (and gets a row in
`e2e/tests/rls/function-grants.spec.ts`), and its finding #8 (cap-race residual)
overlaps P6.4 — coordinate, don't duplicate.

### P6.1 `[ ]` Make `handle_new_user()` unable to block signup
- **Where:** `handle_new_user()` in schema.sql (~:158-179); the CHECKs it can trip
  are `users.name` ≤50 chars (~:18) and the `avatar_url` host allowlist (~:19-22).
- **Do:** Inside the trigger function, sanitize before insert: `left(name, 50)`;
  if `avatar_url` fails the allowlist regex, insert NULL instead. Also widen the
  Google host pattern from `lh3.googleusercontent.com` to
  `lh[0-9]+.googleusercontent.com` (legacy lh4/lh5/lh6 avatars exist) in BOTH the
  CHECK and the trigger's validation.
- **Done when:** schema.sql updated; local reset + a dev-login/OAuth-path e2e passes
  if runnable; prod SQL (CREATE OR REPLACE FUNCTION + ALTER TABLE ... DROP/ADD
  CONSTRAINT) recorded in Work Log.

### P6.2 `[ ]` Timezone-correct "future" cutoffs for sessions
- **Where:** sessions INSERT policy (`date >= CURRENT_DATE`, ~:543) and
  `count_future_sessions` (~:261).
- **Do:** Both evaluate CURRENT_DATE in UTC while games have a `timezone` column.
  Add a STABLE helper, e.g.
  `game_today(p_game_id uuid) RETURNS date` computing
  `(now() AT TIME ZONE COALESCE((SELECT timezone FROM games WHERE id = p_game_id), 'UTC'))::date`
  (SECURITY DEFINER to match the existing helper style), and use it in both places:
  policy `date >= game_today(game_id)`; count function compares
  `date >= game_today(game_id)`. Mind NULL timezones (COALESCE to 'UTC' preserves
  today's behavior).
- **Done when:** schema.sql updated; local reset + `e2e/tests/scheduling` pass if
  runnable; prod SQL in Work Log.

### P6.3 `[ ]` Add missing CHECK constraints
- **Where:** `availability` (~:75-76), `user_availability_defaults` (~:90-91),
  `games.play_days` (~:37).
- **Do:** Add `CHECK (available_after IS NULL OR available_until IS NULL OR
  available_after < available_until)` to both tables; add
  `CHECK (play_days <@ ARRAY[0,1,2,3,4,5,6])` to games. Before finalizing, scan the
  app's write paths (`src/lib/data/availability.ts`, `gameValidation.ts`, GameForm)
  to confirm the app never legitimately writes rows the new CHECKs would reject —
  record what you checked.
- **Done when:** schema.sql updated; local reset + unit/e2e pass if runnable; prod
  SQL in Work Log **including a pre-flight query** the human runs first to find any
  existing violating rows.

### P6.4 `[ ]` (Stretch) Usage caps → typed errors instead of RLS `WITH CHECK`
- **Where:** 20-games cap (~:471), 100-future-sessions cap (~:544); reference
  pattern: `join_game_by_invite`'s `RAISE ... 'Game is full'` (~:388).
- **Do:** Move the count checks from `WITH CHECK` into `BEFORE INSERT` triggers that
  `RAISE EXCEPTION` with clear messages (and can lock/serialize the count to close
  the TOCTOU race, e.g. advisory lock on the user/game id). Keep the rest of each
  policy intact. First locate any existing usage-limit e2e specs (grep e2e/ for
  "limit"/"20 games") and keep them green; the app's error-handling paths that parse
  the RLS error string may need updating — find them by grepping for the current
  error-matching logic.
- **Done when:** local reset + limit specs pass if runnable; app error UX verified
  or explicitly noted; prod SQL in Work Log. If this proves too risky to verify in
  the environment, mark `[B]` rather than half-landing it.

### P6.5 `[ ]` Draft the production migration-strategy design doc (no implementation)
- **Files:** new `docs/plans/2026-07-XX-prod-migration-strategy-design.md`.
- **Do:** Write a 1-2 page proposal for versioned prod migrations: keep `schema.sql`
  as the fresh-install artifact; generate immutable timestamped migration files for
  each prod change; add a DB step to `deploy.yml` (`supabase db push --linked` or
  psql-driven); include a drift-check idea (CI job diffing a freshly-applied
  schema.sql against migrations applied in sequence). Enumerate the open decisions
  for the human (secrets, Supabase project linking, rollback policy). Do NOT change
  any workflow or schema in this item.
- **Done when:** doc committed; decisions-for-human section present.

## Phase 7 — `src/lib` reorganization + test hygiene (T8, T9)

### P7.1 `[ ]` `lib/availability/` folder + one shared eligibility predicate
- **Files:** move `availability.ts`, `availabilityStatus.ts`, `bulkAvailability.ts`,
  `copyAvailability.ts`, `defaultAvailability.ts` (with their tests) into
  `src/lib/availability/`; new `eligibleDates.ts` inside it.
- **Do:** First extract the duplicated "eligible play date" predicate — the
  is-play-day-or-extra-date ∧ not-past ∧ (optionally) blank-in-destination filter
  currently re-implemented at `bulkAvailability.ts:40-63`, `defaultAvailability.ts:53-65`,
  `copyAvailability.ts:47-63` & ~:116-129, `availability.ts:53-63` & ~:159-169 — into
  one function (or small composable predicates) in `eligibleDates.ts`; convert all
  five sites to use it, keeping each module's tests green (the differing signatures
  — injected formatDate vs date-fns — should collapse into the shared helper's
  signature). Then move the five modules + tests into the folder and update imports
  (mechanical; typecheck is the net).
- **Done when:** one predicate implementation (grep the old inline patterns); all
  existing availability tests pass; lint/typecheck/unit pass.

### P7.2 `[ ]` Fold schedule + admin-analytics clusters; merge duplicate formatters
- **Files:** `src/lib/schedule/` ← `suggestions`, `scheduling`, `scheduleView`,
  `upcomingSessions`, `otherGameSessions`, `gameHealth` (+tests);
  `src/lib/admin/` ← `adminEngagement`, `topUsers` (+tests).
- **Do:** Mechanical moves + import updates. Post-#133 additions: place
  `dashboardData.ts` (+test) with the schedule/dashboard cluster; leave
  `queryKeys.ts` at `lib/` top level (it is a cross-domain registry, not domain
  logic). While touching them, merge
  `scheduleView.formatTimeWindow` (~:36-47) and
  `otherGameSessions.formatSessionTimeWindow` (~:50-61) into one exported formatter
  (they're the same start/end → "X–Y / from X / until Y" logic); keep both call
  sites' rendered output identical (their tests pin it).
- **Done when:** moves complete, one time-window formatter remains, all tests pass,
  lint/typecheck pass.

### P7.3 `[ ]` E2E + unit-test hygiene
- **Files:** `e2e/helpers/seed.ts` (~:251), `e2e/README.md` (create if absent),
  `src/lib/suggestions.test.ts` (~:156-178, ~:291-313),
  `src/app/api/test-auth/route.ts` (only if P2.4 didn't already add the comment).
- **Do:** (a) `cleanDatabase()` is defined but never called — delete it, and write a
  short "Test isolation" section in `e2e/README.md` documenting the actual contract:
  unique per-test data + RLS scoping, and the rule that tests must not assert on
  global aggregates (presence-style assertions only, as `admin/dashboard.spec.ts`
  already does). (b) Hoist the duplicated `makeSuggestion` factory in
  `suggestions.test.ts` to one shared helper at the top of the file.
- **Done when:** dead code gone, README section exists, suggestions tests pass with
  a single factory; lint/typecheck/unit pass.

---

## Loop Protocol

Each loop iteration:

1. `git fetch origin <branch> && git pull origin <branch>` (retry per repo git rules
   on network failure). Read this plan file fresh — it is the single source of truth.
2. **Select** the first item (top-to-bottom) whose status is `[ ]` and whose stated
   dependencies (each item's "Depends on" mentions, and phase ordering for Phase 0
   and P3.1→P3.2→P3.3, P5.2→P5.3) are `[x]`. Skip `[B]` and `[D]` items. Skip
   `[G1]`-tagged items (and Gate G1 itself unless its eligibility check passes)
   while Gate G1 is not `[x]`.
3. **Implement exactly that one item**, including its tests, per the Ground Rules.
   If mid-way you judge the item too large for one iteration, stop, split it: mark
   it `[S]`, insert sub-items (`Pn.mA`, `Pn.mB`, …) directly beneath it with their
   own Definitions of Done, complete the FIRST sub-item this iteration.
4. **Verify** everything listed under the item's "Done when", plus the baseline
   (`npm run lint && npm run typecheck && npm run test:run`). If verification fails,
   fix it before proceeding — never check a box on a red build.
5. **Record**: flip the checkbox to `[x]` (or `[B]` with a reason), and append a Work
   Log entry (template below) — in the SAME commit as the change.
6. **Commit & push** (`git push -u origin <branch>`, exponential-backoff retries on
   network errors only).
7. **Blocked handling:** if an item cannot proceed (missing tooling, needs human
   decision, repeated failure after 2 genuine attempts), mark `[B]`, write exactly
   what a human must do to unblock it, commit that plan update, and move on next
   iteration. Never delete or reorder items you didn't author.
8. **Exit:** when every item is `[x]` or `[B]`: run the full suite one final time
   (`npm run lint && npm run typecheck && npm run test:run`, plus
   `npm run test:e2e` if the environment supports it and `npm run build`), append a
   **Final Summary** Work Log entry (items done, items blocked + unblock actions,
   all HUMAN ACTION REQUIRED SQL collected in one place), push, and END the loop —
   do not schedule another iteration.

### Work Log entry template

```
### <date> — <item id>: <one-line summary> — <DONE | BLOCKED | SPLIT>
- Changed: <files>
- Verification: <commands run and results, e2e run or deferred>
- Notes: <surprises, judgment calls, prod SQL if Phase 6 (tagged HUMAN ACTION REQUIRED)>
```

---

## Discovered Work

(Add one-liners here instead of fixing out-of-scope issues. A human will triage.)

- (from review, deliberately not planned) `games/[id]/layout.tsx` uses the
  service-role client in `generateMetadata`, leaking game names to non-members via
  the page title — decide desired behavior before fixing.
- (from review, deliberately not planned) Server-side prefetch/hydration for the
  `games/[id]` hook waterfall (review T7) — worthwhile but needs a design pass.
- (from review, deliberately not planned) `wipe-data.sql`/`wipe-database.ts` omit
  `user_availability_defaults` and `game_play_dates` (rely on CASCADE).

## Work Log

(Append entries below; never rewrite existing entries.)

### 2026-07-09 — P0.1: typecheck script + CI step — DONE
- Changed: `package.json` (added `"typecheck": "tsc --noEmit"`),
  `.github/workflows/ci.yml` (Typecheck step between Lint and Unit Tests), and four
  test files with pre-existing type errors that tsc surfaced on first run (unit
  tests had been passing because vitest doesn't typecheck): missing vitest imports
  in `StatusBanner.test.tsx` and `admin.test.ts` (repo convention is explicit
  imports, not globals), `GameSession` fixtures missing `location`/`notes` in
  `scheduleView.test.ts`, and an untyped `vi.fn()` mock vs `StatusListener` in
  `supabase/client.test.ts`. All four fixes are types/imports only — zero runtime
  behavior change.
- Verification: `npm run lint` clean, `npm run typecheck` exits 0,
  `npm run test:run` 584/584 pass.
- Notes: none.

### 2026-07-09 — G1: Merged post-#133 main; revised gated items — DONE
- Changed: merged `origin/main` (`560a222`, brings PRs #132 + #133) into the branch
  (clean merge — this branch only carried docs); revised P1.3, P2.2, P3.1–P3.3,
  P5.2, P5.3, P7.2, Phase 6 intro, Ground Rule 2, and the review doc's T7 note.
- Verification: `npm run lint` clean; `npm run test:run` 584/584 pass post-merge.
  (No typecheck script yet — that is P0.1.)
- Notes: #133 resolved the DashboardContent data-layer bypass (P2.2 shrinks to
  settings/page.tsx) and superseded the withOptimistic standardization (Phase 3
  rewritten around the TanStack Query pattern now documented in CLAUDE.md's "Data
  Fetching & Caching" section; `withOptimistic` has one importer left —
  `useGameMeta.ts:90` — and P3.2 now retires it). #132 revealed the existing
  local-only `docs/migrations/*-prod.sql` convention, now referenced by Ground
  Rule 2, and added the function-grant lockdown Phase 6 items must follow.
