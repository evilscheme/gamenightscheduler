# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server against cloud Supabase (.env.local)
npm run dev:local    # Start dev server against local Supabase (.env.local.supabase)
npm run build        # Build for production
npm run lint         # Run ESLint
npm run db:wipe      # Clear all data from database (keeps schema)

# Local Supabase (requires Supabase CLI: brew install supabase/tap/supabase)
npm run db:start     # Start local Supabase containers
npm run db:stop      # Stop local Supabase containers
npm run db:reset     # Reset local DB and reapply schema.sql
npm run db:status    # Show local Supabase status and credentials

# Database backup (requires pg_dump)
npm run db:backup    # Backup cloud DB (uses DATABASE_URL from .env.local)

# Workspace setup (for git worktrees / Conductor workspaces)
npm run setup        # Copy .env files from main project, check origin/main sync
npm run setup -- --force  # Same but overwrite existing .env files

# Unit Testing (Vitest)
npm run test              # Run unit tests in watch mode
npm run test:run          # Run unit tests once
npm run test:coverage     # Run unit tests with coverage report

# E2E Testing (Playwright)
npm run test:e2e          # Run all e2e tests
npm run test:e2e:ui       # Run with Playwright UI
npm run test:e2e:headed   # Run in headed browser mode
npm run test:e2e:debug    # Run in debug mode
```

## Development Practices

- Use `psql` (not `pgsql`) as the Postgres client tool
- Don't ever directly migrate the database unless explicitly requested to. Favor creating migration files for a human to apply
- Always consider how the UI will render on a mobile device. Make sure the design looks equally good on desktop and mobile
- **Validate UI changes locally.** After making UI/UX changes, view them in the browser using `npm run dev:local` with a dev-login user (see [Local Dev Authentication](#local-dev-authentication)). Check both desktop and mobile screen sizes to confirm the design looks good at both breakpoints.
- Keep international users in mind. Don't make the interface overly US-centric. Default to US-style behavior but support user preferences for alternatives (e.g., 12 vs 24 hour time)

## Styling

- **Never use hardcoded color classes** (e.g., `bg-blue-500`, `text-blue-700`, `dark:text-blue-300`). The app supports multiple color themes, so always use semantic theme classes instead.
- For info callouts/highlights: `bg-primary/10 border border-primary/30 rounded-lg` with `text-primary`
- For badges: `bg-primary/10 text-primary`
- Available semantic color classes: `primary`, `secondary`, `muted`, `accent`, `card`, `destructive`, `foreground`, `border`, `ring` (each with `-foreground` variant where applicable)

## Testing Requirements

**IMPORTANT: Every feature or behavior change MUST include tests.**

Before marking any implementation task as complete:
1. Identify what tests are needed (unit tests for logic in `src/lib/`, E2E tests for user-facing flows in `e2e/tests/`)
2. Propose the test plan to the user
3. Write and run the tests
4. Do NOT consider the task done until tests pass

This applies to: new features, bug fixes, refactors that change behavior, new API routes, and new utility functions. Skip tests only for pure styling/cosmetic changes or config-only changes.

## Architecture

This is a Next.js 16 App Router application for scheduling game nights. Players mark availability on a calendar, and the app suggests optimal dates. Key features include three-state availability (available/unavailable/maybe), co-GM support, calendar subscription feeds, and special play dates.

### Authentication

Uses Supabase Auth with Google and Discord OAuth. OAuth providers are configured in the Supabase Dashboard (not env vars).

- `src/contexts/AuthContext.tsx` - Auth context providing `useAuth()` hook
- `src/lib/supabase/client.ts` - Browser client (uses anon key)
- `src/lib/supabase/server.ts` - Server client for server components
- `src/lib/supabase/admin.ts` - Admin client (service role key, bypasses RLS)
- `src/app/auth/callback/route.ts` - OAuth callback handler

The `useAuth()` hook provides user, session, profile, loading state, OAuth sign-in methods, and sign-out.

**Gotcha:** Supabase Redirect URLs must use `/**` wildcard suffix or query parameters (e.g., `?next=/games/join/ABC`) get stripped.

### Local Dev Authentication

A dev-login page (`src/app/dev-login/`) allows bypassing OAuth for local development. It only works when `NODE_ENV === 'development'` and the Supabase URL points to localhost — it returns a 404 in production.

**Setup:**
1. Start local Supabase: `npm run db:start`
2. Start dev server: `npm run dev:local`
3. Navigate to http://localhost:3000/dev-login (or click "Dev Login" on the login page)

**Dev users** (defined in `src/app/dev-login/actions.ts`):
- **Dev GM** (`dev-gm@dev.local`) — standard GM user
- **Dev Player 1** (`dev-player1@dev.local`) — standard player
- **Dev Player 2** (`dev-player2@dev.local`) — standard player
- **Dev Admin** (`dev-admin@dev.local`) — admin user

Users are auto-created in the local Supabase on first login and persist across sessions. You can switch between personas instantly from the dev-login page. The page supports a `callbackUrl` query parameter to redirect after login (e.g., `/dev-login?callbackUrl=/games/abc`).

### Database

Supabase PostgreSQL with Row Level Security. Schema in `supabase/schema.sql`.

Key tables:
- `users` - Profiles linked to `auth.users` via id (auto-created on signup via trigger)
- `games` - Games with host (GM), play days array, invite code, scheduling window, default session times, special play dates, minimum players needed
- `game_memberships` - Players in each game (includes `is_co_gm` flag)
- `availability` - Available/unavailable/maybe dates per player per game (with optional comment, optional `available_after`/`available_until` time constraints)
- `sessions` - Scheduled game nights (confirmed status with start/end times)

RLS uses `auth.uid()` and helper functions (SECURITY DEFINER) like `is_game_participant()` and `is_game_gm_or_co_gm()` to avoid recursion issues.

**Migrations:** The `supabase/migrations/00000000000000_initial_schema.sql` is a symlink to `schema.sql`. When adding new columns, tables, policies, or indexes, modify `schema.sql` directly — do NOT create a separate migration file. The symlink ensures schema changes are applied automatically. A separate migration file will fail CI because the initial schema already created the object (e.g., "column already exists", "policy already exists" SQLSTATE 42710). Only create a standalone migration file for production deployment (never committed to the repo alongside the schema.sql change).

### Key Patterns

- All page components use `'use client'` directive
- All users have GM capabilities by default (`is_gm: true`)
- Games use invite codes (nanoid-10) for players to join
- GMs can promote members to co-GMs who can edit games and confirm sessions
- Availability has three states: available, unavailable, maybe (with optional comment and optional time-of-day constraints on available/maybe)
- GMs/co-GMs can add special play dates for one-off sessions outside regular play days

### Shared Utilities

- `src/hooks/useAuthRedirect.ts` - Hook for protected pages (redirects to login, optionally requires GM)
- `src/hooks/useUserPreferences.ts` - Single source of truth for user i18n preferences (time format, week start)
- `src/lib/constants.ts` - Shared constants (day labels, timeouts, session defaults, usage limits, text limits)
- `src/lib/availability.ts` - Player completion percentage calculations
- `src/lib/availabilityStatus.ts` - Availability state cycling (available → unavailable → maybe)
- `src/lib/suggestions.ts` - Date suggestion ranking algorithm
- `src/lib/ics.ts` - ICS (iCalendar) file generation for calendar export
- `src/lib/formatting.ts` - Time formatting utilities (24h to 12h conversion, compact `formatTimeShort`)
- `src/lib/gameValidation.ts` - Game form validation
- `src/lib/bulkAvailability.ts` - Bulk availability marking logic
- `src/lib/copyAvailability.ts` - Copy/filter availability entries between games
- `src/lib/timezone.ts` - Timezone detection, display formatting, and conversion
- `src/lib/themes.ts` - Theme configuration and utilities
- `src/contexts/ThemeContext.tsx` - Theme context (uses next-themes)
- `src/components/ui/` - Reusable components: Button, Card, Input, Textarea, LoadingSpinner, EmptyState

### Calendar Components

- `src/components/calendar/AvailabilityCalendar.tsx` - Interactive multi-month calendar
  - Click dates to cycle: available → unavailable → maybe
  - Long-press/hover for notes and time-of-day constraints on any date
  - Bulk actions: "Mark all remaining/[day] as [status]"
  - GMs can add special play dates on non-play days
  - Visual indicators: play days, confirmed sessions, today

### Game Components

- `src/components/games/GameDetailsCard.tsx` - Game settings and info display
- `src/components/games/PlayersCard.tsx` - Player list and management
- `src/components/games/SchedulingSuggestions.tsx` - Date suggestions ranked by availability
  - Shows player breakdown (available/maybe/unavailable/pending) with time annotations
  - Displays computed time window (earliest start / latest end) from player constraints
  - Minimum player threshold: GMs can set a minimum, dates below threshold show "X/Y needed" and are ranked lower
  - Confirm modal pre-fills times based on player constraints and game defaults
  - Separates upcoming vs past sessions
  - Export to calendar (.ics download or webcal://)

### Account Deletion

Self-service account deletion is accessed from Settings > Danger Zone. The flow is a multi-step wizard:

1. **Preview** — `/api/account/delete-preview` fetches owned games (with members), and games the user is a player in
2. **Decisions** — For games with other players, the user chooses to delete or transfer each game to another member
3. **Confirmation** — Summary of actions with `DELETE` confirmation word
4. **Execution** — `/api/account/delete` processes transfers, deletes `public.users` (cascading to games, memberships, availability, sessions), then deletes `auth.users`

Key files:
- `src/app/settings/delete-account/page.tsx` — Deletion wizard UI
- `src/app/api/account/delete-preview/route.ts` — Preview API
- `src/app/api/account/delete/route.ts` — Deletion API
- `scripts/delete-user.ts` — Admin CLI tool (`npx tsx scripts/delete-user.ts <email-or-uuid>`)
- `e2e/tests/settings/delete-account.spec.ts` — E2E tests

### E2E Testing

Tests are in `e2e/tests/` organized by feature. The test harness uses:
- `e2e/fixtures/auth.fixture.ts` - Authenticated page fixture
- `e2e/helpers/seed.ts` - Database seeding utilities
- `e2e/helpers/test-auth.ts` - Test user authentication

Tests require `.env.test.local` with test database credentials. CI runs via GitHub Actions (`.github/workflows/e2e.yml`).

**Testing workflow:** When fixing failing tests, run them individually rather than the full suite:
```bash
# Run a specific test file
npx playwright test e2e/tests/settings/profile.spec.ts --project=chromium

# Run a specific test by line number
npx playwright test "e2e/tests/settings/profile.spec.ts:46" --project=chromium

# Run all tests in a directory
npx playwright test e2e/tests/multi-user --project=chromium
```

### Usage Limits

Enforced via RLS policies in the database:
- 20 games per user (as GM)
- 50 players per game
- 100 future sessions per game

### Environment Files

- `.env.local` - Cloud Supabase credentials (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, DATABASE_URL)
- `.env.local.supabase` - Local Supabase credentials (same keys, local values)
- `.env.test.local` - Test database credentials for E2E tests

### Other Key Files

- `public/logo.png` - App logo (use instead of emojis for branding; import with Next.js `Image`)
- `src/components/layout/Providers.tsx` - Wraps app with ThemeProvider and AuthProvider
- `src/components/layout/Navbar.tsx` - Navigation bar with user menu and help dropdown
- `src/app/opengraph-image.tsx` - Default OG image
- `src/app/games/join/[code]/opengraph-image.tsx` - Dynamic OG image for invite links
