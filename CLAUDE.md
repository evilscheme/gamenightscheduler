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

# E2E Testing (Playwright)
npm run test:e2e          # Run all e2e tests
npm run test:e2e:ui       # Run with Playwright UI
npm run test:e2e:headed   # Run in headed browser mode
npm run test:e2e:debug    # Run in debug mode
```

## Architecture

This is a Next.js 16 App Router application for scheduling game nights. Players mark availability on a calendar, and the app suggests optimal dates.

### Authentication

Uses Supabase Auth with Google and Discord OAuth. OAuth providers are configured in the Supabase Dashboard (not env vars).

- `src/contexts/AuthContext.tsx` - Auth context providing `useAuth()` hook
- `src/lib/supabase/client.ts` - Browser client (uses anon key)
- `src/lib/supabase/server.ts` - Server client for server components
- `src/lib/supabase/middleware.ts` - Session refresh helper
- `src/proxy.ts` - Next.js 16 proxy configuration (replaces middleware.ts)
- `src/app/auth/callback/route.ts` - OAuth callback handler

The `useAuth()` hook provides: `user`, `session`, `profile`, `isLoading`, `signInWithGoogle()`, `signInWithDiscord()`, `signOut()`, `refreshProfile()`.

**Supabase URL Configuration:** In Supabase Dashboard > Authentication > URL Configuration, the "Redirect URLs" allowlist must include wildcard patterns for OAuth callbacks with query parameters to work (e.g., for post-login redirects to invite links). Use `/**` suffix:
```
http://localhost:3000/**
https://your-production-domain.com/**
```
Without the wildcard, Supabase may strip query parameters like `?next=/games/join/ABC` from redirect URLs.

### Database

Supabase PostgreSQL with Row Level Security. Schema in `supabase/schema.sql`.

Key tables:
- `users` - Profiles linked to `auth.users` via id (auto-created on signup via trigger)
- `games` - Games with host (GM), play days array, invite code
- `game_memberships` - Players in each game
- `availability` - Available/unavailable dates per player per game
- `sessions` - Scheduled game nights (suggested/confirmed/cancelled)

RLS uses `auth.uid()` and a `is_game_participant()` helper function (SECURITY DEFINER) to avoid recursion issues.

### Key Patterns

- All page components use `'use client'` directive
- `src/components/layout/Providers.tsx` wraps app with ThemeProvider and AuthProvider
- Users must enable "GM mode" in Settings (`is_gm` flag) to create games
- Games use invite codes (nanoid) for players to join

### Shared Utilities

- `src/hooks/useAuthRedirect.ts` - Hook for protected pages (redirects to login, optionally requires GM)
- `src/lib/constants.ts` - Shared constants (day labels, timeout values, session defaults)
- `src/components/ui/` - Reusable components: Button, Card, Input, Textarea, LoadingSpinner, EmptyState

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

### Tools
- psql is the postgres client library, not pgsql

### Development Practices to Follow
when adding a significant new feature, make sure to add tests for that feature as well