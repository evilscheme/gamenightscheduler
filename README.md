# Quest Calendar - D&D Session Scheduler

A web app to help tabletop RPG groups coordinate game sessions. GMs create campaigns, players mark their availability, and the app suggests optimal dates based on everyone's schedules.

## Features

- **Multiple Campaigns**: Manage several games at once, each with its own players
- **Availability Calendar**: Players mark when they're free on designated play days
- **Smart Suggestions**: Dates ranked by player availability
- **Easy Invites**: Share a simple invite link to add players
- **Calendar Export**: Export sessions to Google Calendar or download .ics files

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
2. **Enable GM mode** in Settings to create games
3. **Create a game** with your desired play days (any combination of Mon-Sun)
4. **Share the invite link** with your players
5. Players **mark their availability** on the calendar
6. View **suggested dates** ranked by player availability
7. **Confirm sessions** and export to your calendar

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── auth/callback/     # OAuth callback handler
│   ├── dashboard/         # User dashboard
│   ├── games/             # Game pages (create, view, join)
│   ├── login/             # Login page
│   └── settings/          # User settings
├── components/
│   ├── calendar/          # Availability calendar
│   ├── games/             # Game-related components
│   ├── layout/            # Navbar, Providers
│   └── ui/                # Reusable UI components
├── contexts/
│   └── AuthContext.tsx    # Supabase Auth context
├── lib/
│   ├── ics.ts             # Calendar export utilities
│   └── supabase/          # Supabase clients (browser, server, admin)
└── types/                 # TypeScript types
```

## License

MIT
