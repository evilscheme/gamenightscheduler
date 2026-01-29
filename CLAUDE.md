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

### Database

Supabase PostgreSQL with Row Level Security. Schema in `supabase/schema.sql`.

Key tables:
- `users` - Profiles linked to `auth.users` via id (auto-created on signup via trigger)
- `games` - Games with host (GM), play days array, invite code, scheduling window, default session times, special play dates, minimum players needed
- `game_memberships` - Players in each game (includes `is_co_gm` flag)
- `availability` - Available/unavailable/maybe dates per player per game (with optional comment, optional `available_after`/`available_until` time constraints)
- `sessions` - Scheduled game nights (confirmed status with start/end times)

RLS uses `auth.uid()` and helper functions (SECURITY DEFINER) like `is_game_participant()` and `is_game_gm_or_co_gm()` to avoid recursion issues.

### Key Patterns

- All page components use `'use client'` directive
- All users have GM capabilities by default (`is_gm: true`)
- Games use invite codes (nanoid-10) for players to join
- GMs can promote members to co-GMs who can edit games and confirm sessions
- Availability has three states: available, unavailable, maybe (with optional comment and optional time-of-day constraints on available/maybe)
- GMs/co-GMs can add special play dates for one-off sessions outside regular play days

### Assets

- `public/logo.png` - App logo. Use this instead of emojis for hero sections, welcome screens, and other prominent branding locations. Import with Next.js `Image` component.

### Shared Utilities

- `src/hooks/useAuthRedirect.ts` - Hook for protected pages (redirects to login, optionally requires GM)
- `src/lib/constants.ts` - Shared constants (day labels, timeouts, session defaults, usage limits, text limits)
- `src/lib/availability.ts` - Player completion percentage calculations
- `src/lib/availabilityStatus.ts` - Availability state cycling (available → unavailable → maybe)
- `src/lib/suggestions.ts` - Date suggestion ranking algorithm
- `src/lib/ics.ts` - ICS (iCalendar) file generation for calendar export
- `src/lib/formatting.ts` - Time formatting utilities (24h to 12h conversion, compact `formatTimeShort`)
- `src/lib/gameValidation.ts` - Game form validation
- `src/lib/bulkAvailability.ts` - Bulk availability marking logic
- `src/lib/themes.ts` - Theme configuration and utilities
- `src/contexts/ThemeContext.tsx` - Theme context (uses next-themes)
- `src/components/ui/` - Reusable components: Button, Card, Input, Textarea, LoadingSpinner, EmptyState

### Layout Components

- `src/components/layout/Providers.tsx` - Wraps app with ThemeProvider and AuthProvider
- `src/components/layout/Navbar.tsx` - Navigation bar with user menu and help dropdown
- `src/components/dashboard/DashboardContent.tsx` - Main dashboard view for authenticated users
- `src/components/dashboard/WelcomeEmptyState.tsx` - Empty state for new users with no games

### API Routes

- `src/app/api/games/invite/[code]/route.ts` - GET game by invite code (authenticated, checks membership)
- `src/app/api/games/preview/[code]/route.ts` - GET game preview for OG crawlers (public, cached 5min)
- `src/app/api/games/calendar/[code]/route.ts` - GET ICS calendar feed for confirmed sessions (public, cached 5min)
- `src/app/api/admin/games/route.ts` - Admin game listing
- `src/app/api/admin/stats/route.ts` - Admin statistics
- `src/app/api/test-auth/route.ts` - Test user management for E2E tests (dev only, blocked in production)

### OG Image Generation

- `src/app/opengraph-image.tsx` - Default OG image for the app
- `src/app/games/join/[code]/opengraph-image.tsx` - Dynamic OG image for game invite links

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

### Development Practices

- When adding a significant new feature, add tests for that feature as well
- Use `psql` (not `pgsql`) as the Postgres client tool
- don't ever directly migrate the database unless explicitly requested to. Favor creating migration files for a human to apply