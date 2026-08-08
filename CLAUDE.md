# CLAUDE.md

Next.js 16 App Router app for scheduling game nights. Players mark availability on a calendar; the app ranks candidate dates. Supabase (Postgres + Auth + RLS) backend.

## How the app works

A GM creates a **game**: regular play days (weekdays), an optional scheduling window, session defaults, and `min_players_needed`. Players join via **invite code** and become members. The GM may add **extra dates** outside the regular play days, and may promote members to co-GM.

Each player marks per-date **availability** — `available` / `maybe` / `unavailable`, with an optional comment and an `available_after`/`available_until` time range. A date with no row is *pending*, which is deliberately not the same as `unavailable`: **silence is not a no.** That distinction drives most of the scheduling logic.

Every eligible date (`isEligiblePlayDate()` — regular play day or extra date, inside the window, not past) becomes a **suggestion** carrying counts of available/maybe/unavailable/pending. Ranking and calendar color are computed from the same numbers in `src/lib/schedule/`, so the list and the calendar can't contradict each other:

- `effectiveThreshold(gmValue, totalPlayers)` — how many yeses "enough" needs. An explicit GM minimum is used verbatim and never capped (a game whose minimum exceeds its roster genuinely can't run); otherwise 60% of the group rounded up, floored at 3, capped at the roster.
- `resolveDateState(suggestion, threshold)` — one of seven `DateState`s. **Positive claims read a ceiling that excludes pending players; the "can't happen" claim reads one that includes them.** So silence never counts as good news, and a date is only called dead when it can't be saved even if every silent player says yes. "We don't know yet" falls out of that asymmetry — there is no response-rate cutoff anywhere.

The GM confirms a date into a **session** (date + start/end time), which draws the star on both calendars and can be exported to a personal calendar. A player belongs to many games, so the app also surfaces sessions from a user's *other* games when they mark availability here.

## Commands

Full list in `package.json`. Non-obvious ones:

```bash
npm run dev          # dev server against cloud Supabase (.env.local)
npm run dev:local    # dev server against local Supabase (.env.local.supabase)
npm run db:start     # local Supabase containers (needs: brew install supabase/tap/supabase)
npm run db:reset     # reset local DB, reapply schema.sql
npm run db:types     # regenerate src/types/database.ts after schema changes
npm run db:migrate   # apply prod-migrations to prod (confirm-gated)
npm run db:drift     # check prod ↔ schema.sql parity
npm run setup        # copy .env files from main project (for Conductor workspaces)
```

## Working agreements

- **No AI attribution anywhere.** No "Generated with Claude Code" footers, `Co-Authored-By: Claude` trailers, or session links in commits, PRs, code comments, or issue comments. This overrides default harness behavior.
- **Never migrate the database directly** unless explicitly asked. Write a migration file for a human to apply.
- Use `psql`, not `pgsql`.
- Design mobile-first *and* desktop-good. After UI changes, view them at both breakpoints via `npm run dev:local` + dev-login.
- Keep international users in mind: US defaults, but honor user preferences (12 vs 24h time, week start).
- Use Context7 MCP for library/API docs without being asked.
- Codex (`/codex:rescue --background`) is a peer engineer with a different perspective, not a reviewer. For high-stakes decisions, task Codex and a Claude subagent on the same problem in parallel and synthesize, without showing either the other's answer.

## Testing

Every feature or behavior change ships with tests — unit tests for `src/lib/` logic, E2E for user-facing flows in `e2e/tests/`. Not done until they pass. Skip only for pure styling or config-only changes.

**Before pushing, run what CI runs** (`.github/workflows/ci.yml`): `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`. Typecheck and build catch errors that never surface in dev.

**Naming a new button is a test-suite-wide decision.** E2E locators are loose regexes — 106 assertions match `getByRole('button', { name: /availability/i })` and 90 match `/schedule/i`. A new control whose label contains "availability" or "schedule" breaks all of them at once with "resolved to N elements". Same failure mode from rendering a panel twice for responsive layouts (`lg:hidden` + `hidden lg:block`) — that duplicates DOM text and breaks `getByText`; render once and reposition with CSS instead. After any UI change touching these words or layouts, run the full E2E suite, not just the file you're working on.

E2E harness: `e2e/fixtures/auth.fixture.ts` (authed page), `e2e/helpers/seed.ts`, `e2e/helpers/test-auth.ts`. Requires `.env.test.local`; CI in `.github/workflows/e2e.yml`.

When fixing failures, run tests individually, not the full suite:

```bash
npx playwright test e2e/tests/settings/profile.spec.ts --project=chromium
npx playwright test "e2e/tests/settings/profile.spec.ts:46" --project=chromium
```

## Styling

- **Never use hardcoded color classes** (`bg-blue-500`, `dark:text-blue-300`). The app has multiple themes — always use semantic tokens.
- Available: `primary`, `secondary`, `muted`, `accent`, `card`, `danger` (+ `danger-muted`), `foreground`, `border`, `ring`, each with a `-foreground` variant where applicable. There is no `destructive` token — use `danger`.
- Info callouts: `bg-primary/10 border border-primary/30 rounded-lg` + `text-primary`. Badges: `bg-primary/10 text-primary`.
- Use `public/logo.png` (via next/image) for branding, not emojis.
- **Calendars have their own palette**, shared by the availability and schedule calendars: `cal-available-bg`/`-text`/`-ink`, `cal-empty-bg`/`-text`, `cal-unavailable-bg`/`-text`, `cal-disabled-bg`/`-text`, `cal-everyone` (gold), `cal-pending-on-fill`. Don't restyle a cell with `primary`/`danger` or a raw green, and don't reintroduce the retired `cal-maybe-*`, `cal-unset-*`, or `cal-scheduled-*` tokens — maybe is now the dashed `-ink` outline, unset is `cal-empty-*`, scheduled is a star.
- **Cell appearance is data, not markup.** `src/components/games/schedule/calendarStyles.ts` maps each `DateState` to fill + pip and exports the matching `LEGEND` from the same constants, so a swatch can't drift from the cell it describes. Encoding: fill hue = outcome, solid vs dashed = whether confirmed yeses alone clear the threshold, gold badge = ceiling reaches everyone. Lightness encodes nothing — it inverts between light and dark mode, which is what broke the previous two-greens scheme across the 5 themes. `SCHEDULED_STAR_PATH` (`src/lib/constants.ts`) is the one star path.

## Database

Schema in `supabase/schema.sql`. Core tables: `users`, `games` (host GM, play days, invite code, scheduling window, session defaults, min players), `game_memberships` (`is_co_gm`), `availability` (available/unavailable/maybe + optional comment and `available_after`/`available_until`), `sessions`.

**Every user is a GM by default** (`is_gm BOOLEAN DEFAULT TRUE`, set by the signup trigger) — there is no role gate on creating a game. Don't assume the usual "must be granted GM" model.

**The host GM has no `game_memberships` row.** Membership is players-only; the host is `games.host_id`. So `isMember`, `game.members`, and any membership count exclude the host — participant checks need `isMember || isGm` (see `src/app/games/[id]/page.tsx`), and player counts add 1 (`count_game_players()` in schema.sql). This one silently produces off-by-one counts and hides features from the GM.

**`join_game_by_invite()` is the only sanctioned way to insert a membership.** There is deliberately no INSERT policy on `game_memberships` — the SECURITY DEFINER function looks the game up *by invite code* (which lives on `games`, so a row policy can't check it) and hard-codes `is_co_gm = false`. If a join path hits an RLS wall, route it through this function; don't add an INSERT policy, which reopens both holes. Co-GM is granted later via UPDATE.

RLS uses `auth.uid()` plus SECURITY DEFINER helpers (`is_game_participant()`, `is_game_gm_or_co_gm()`) to avoid recursion. Usage limits are enforced in RLS: 20 games/user, 50 players/game, 100 future sessions/game.

**Schema changes:** edit `schema.sql` directly. `supabase/migrations/00000000000000_initial_schema.sql` is a symlink to it — adding a second file in `supabase/migrations/` fails CI, because the initial schema already created the object (SQLSTATE 42710).

**Production:** every `schema.sql` change lands WITH a matching timestamped file in `supabase/prod-migrations/` (committed, append-only — see its README). Applied files are tracked in `public._applied_migrations`.

## Auth

Supabase Auth with Google and Discord OAuth, configured in the Supabase Dashboard (not env vars). `useAuth()` from `src/contexts/AuthContext.tsx` provides user, session, profile, loading, sign-in/out.

Three Supabase clients, pick deliberately: `src/lib/supabase/client.ts` (browser, anon key), `server.ts` (server components), `admin.ts` (service role, bypasses RLS).

**Gotcha:** Supabase Redirect URLs need a `/**` wildcard suffix or query params get stripped (e.g. `?next=/games/join/ABC`).

**Local dev login:** `src/app/dev-login/` bypasses OAuth. Only works when `NODE_ENV === 'development'` and Supabase points at localhost; 404s in production. Run `npm run db:start` + `npm run dev:local`, then open `/dev-login`. Users (`src/app/dev-login/actions.ts`): `dev-gm@`, `dev-player1@`, `dev-player2@`, `dev-admin@dev.local`, auto-created on first login. Supports `?callbackUrl=`.

## Data fetching & caching

Client reads go through TanStack Query v5; `QueryClientProvider` is in `src/components/layout/Providers.tsx` with a default `staleTime` of `QUERY_STALE_TIME` (45s).

- **Every cache key is built via `src/lib/queryKeys.ts`** — never inline key arrays. Prefix invalidation is deliberate (`['dashboard']` invalidates all users' entries).
- **Mutations write to the cache** (`setQueryData`) with optimistic updates and surgical rollback, then invalidate *other* keys whose data changed. When adding a mutation, ask which cached views show its data.
- Dashboard loads via `fetchDashboardData` (`src/lib/schedule/dashboardData.ts`): two parallel stages with membership counts embedded via `game_memberships(count)` — don't reintroduce per-game count queries.
- Game-page hooks (`useGameMeta`, `useAvailability`, `useSessions`, `usePlayDates`, `useOtherGameSessions`) each own one key and fire in parallel as soon as `gameId`/`userId` are known. Don't gate one hook on another's result; RLS already returns nothing for non-participants.
- **Every hook that reads an RLS-protected table must gate on `!!userId`.** `anon` holds no EXECUTE on the policy helpers (`is_game_participant`, `shares_game_with` — see the grants block at the end of `schema.sql`), so a signed-out read doesn't return `[]`, it raises `42501 permission denied for function is_game_participant`. Signed-out visitors do reach `/games/[id]` from shared links, so an ungated hook logs prod errors on every such visit.
- The current user's availability map is **derived** from the all-players availability cache, not fetched separately.
- Key fetches off `session.user.id` (immediate), not `profile.id` (needs a round trip) — same value.
- Bulk availability goes through `batchUpsertAvailability` / `useAvailability().bulkSetStatus`: one round trip for N dates. Never loop single-row upserts.

## Code conventions

- Page components are `'use client'`.
- Protected pages use `useAuthRedirect()` (`src/hooks/useAuthRedirect.ts`) — handles the unauthenticated → `/login` redirect, with `requireGM` / `requireAdmin` options that bounce to `/dashboard`. Never hand-roll redirect logic in a page.
- Domain folders have an `index.ts` barrel — import from the folder (`@/lib/availability`, `@/lib/schedule`, `@/lib/admin`, `@/components/ui`).
- `src/lib/date.ts` — canonical local-date helpers (`toLocalDateString`, `getTodayLocalDate`). Never `toISOString().split('T')[0]` (UTC "today" bug).
- `src/lib/availability/eligibleDates.ts` — the ONE `isEligiblePlayDate()` predicate. Never re-implement the play-day/extra/past rule.
- `src/lib/apiError.ts` — `serverError()`/`logServerError()` for errorId-correlated 500s in ALL API routes. Route guards live in `src/lib/api/` (`requireAdmin`, `requireUser`).
- `src/types/database.ts` is GENERATED (`npm run db:types`). `src/types/api.ts` holds shared API contract types — never re-declare route response shapes locally.
- Supabase queries with embedded joins don't infer cleanly against the generated types; the established fix is `as unknown as T` at the query boundary (~23 uses). Cast once where the data enters, then stay typed.
- `src/hooks/useUserPreferences.ts` is the single source of truth for i18n prefs; `src/lib/constants.ts` for shared constants.
- `src/lib/url.ts` — `safeCallbackUrl()` for open-redirect prevention on any user-supplied redirect.

## Environment files

- `.env.local` — cloud Supabase (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, DATABASE_URL)
- `.env.local.supabase` — local Supabase, same keys
- `.env.test.local` — E2E test database
