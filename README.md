# Can We Play? - Game Night Scheduler

A web app to help groups coordinate game nights. Hosts create games, players mark their availability, and the app suggests optimal dates based on everyone's schedules.

## Features

- **Multiple Games**: Manage several games at once, each with its own players
- **Availability Calendar**: Mark availability as available, unavailable, or maybe with optional notes and time-of-day constraints
- **Smart Suggestions**: Dates ranked by player availability with detailed breakdowns and computed time windows
- **Easy Invites**: Share a simple invite link to add players
- **Calendar Export**: Download .ics files or subscribe to calendar feeds
- **Co-GM Support**: Delegate game management to trusted players
- **Special Play Dates**: Schedule one-off sessions outside regular play days
- **Past Sessions**: View history of completed game nights

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS 4
- Supabase (PostgreSQL + Auth)

## Setup

### 1. Clone and Install

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the schema from `supabase/schema.sql`
3. Copy your project URL and keys from Settings > API

### 3. Configure OAuth Providers

In the Supabase Dashboard, go to Authentication > Providers and enable:

**Google:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add `https://<your-project>.supabase.co/auth/v1/callback` as authorized redirect URI
4. Copy Client ID and Secret to Supabase Dashboard

**Discord:**
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Add `https://<your-project>.supabase.co/auth/v1/callback` as redirect URI
4. Copy Client ID and Secret to Supabase Dashboard

### 4. Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key (safe for browser)

### 5. Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Usage

1. **Sign in** with Google or Discord
2. **Create a game** with your desired play days and default session times
3. **Share the invite link** with your players
4. Players **mark their availability** on the calendar (available, unavailable, or maybe)
5. View **suggested dates** ranked by player availability
6. **Confirm sessions** and set specific times
7. **Export to calendar** via .ics download or subscribe via webcal:// URL

## Testing

The project uses Playwright for end-to-end testing.

```bash
npm run test:e2e          # Run all e2e tests
npm run test:e2e:ui       # Run with Playwright UI
npm run test:e2e:headed   # Run in headed browser mode
npm run test:e2e:debug    # Run in debug mode
```

Tests require a `.env.test.local` file with test database credentials.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes (invite, preview, calendar feed, admin)
│   ├── auth/callback/     # OAuth callback handler
│   ├── dashboard/         # User dashboard
│   ├── games/             # Game pages (create, view, edit, join)
│   ├── admin/             # Admin dashboard
│   ├── login/             # Login page
│   └── settings/          # User settings
├── components/
│   ├── calendar/          # Availability calendar with bulk actions
│   ├── dashboard/         # Dashboard content and empty states
│   ├── games/             # Scheduling suggestions component
│   ├── layout/            # Navbar, Providers, ThemeToggle
│   ├── settings/          # Theme picker
│   └── ui/                # Reusable UI components
├── contexts/
│   ├── AuthContext.tsx    # Supabase Auth context
│   └── ThemeContext.tsx   # Theme state management
├── hooks/
│   └── useAuthRedirect.ts # Auth redirect hook for protected pages
├── lib/
│   ├── availability.ts    # Availability completion calculations
│   ├── availabilityStatus.ts # Status cycling logic
│   ├── constants.ts       # Shared constants and limits
│   ├── formatting.ts      # Time formatting utilities
│   ├── gameValidation.ts  # Form validation
│   ├── ics.ts             # ICS calendar file generation
│   ├── suggestions.ts     # Date suggestion ranking
│   └── supabase/          # Supabase clients (browser, server, admin)
└── types/                 # TypeScript types

e2e/
├── fixtures/              # Playwright test fixtures
├── helpers/               # Test utilities (auth, seeding)
└── tests/                 # Test specs organized by feature
```

## License

MIT
