# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server at localhost:3000
npm run build    # Build for production
npm run lint     # Run ESLint
npm run db:wipe  # Clear all data from database (keeps schema)
```

## Architecture

This is a Next.js 16 App Router application for scheduling D&D game sessions. Players mark availability on a calendar, and the app suggests optimal dates.

### Authentication

Uses Supabase Auth with Google and Discord OAuth. OAuth providers are configured in the Supabase Dashboard (not env vars).

- `src/contexts/AuthContext.tsx` - Auth context providing `useAuth()` hook
- `src/lib/supabase/client.ts` - Browser client (uses anon key)
- `src/lib/supabase/server.ts` - Server client for server components
- `src/lib/supabase/middleware.ts` - Session refresh helper
- `src/app/auth/callback/route.ts` - OAuth callback handler

The `useAuth()` hook provides: `user`, `profile`, `isLoading`, `signInWithGoogle()`, `signInWithDiscord()`, `signOut()`, `refreshProfile()`.

### Database

Supabase PostgreSQL with Row Level Security. Schema in `supabase/schema.sql`.

Key tables:
- `users` - Profiles linked to `auth.users` via id (auto-created on signup via trigger)
- `games` - Campaigns with GM, play days array, invite code
- `game_memberships` - Players in each game
- `availability` - Available/unavailable dates per player per game
- `sessions` - Scheduled game nights (suggested/confirmed/cancelled)

RLS uses `auth.uid()` and a `is_game_participant()` helper function (SECURITY DEFINER) to avoid recursion issues.

### Key Patterns

- All page components use `'use client'` directive
- `src/components/layout/Providers.tsx` wraps app with ThemeProvider and AuthProvider
- Users must enable "GM mode" in Settings (`is_gm` flag) to create games
- Games use invite codes (nanoid) for players to join
