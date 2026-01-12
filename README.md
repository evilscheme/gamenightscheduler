# Quest Calendar - D&D Session Scheduler

A web app to help tabletop RPG groups coordinate game sessions. GMs create campaigns, players mark their availability, and the app suggests optimal dates based on everyone's schedules.

## Features

- **Multiple Campaigns**: Manage several games at once, each with its own players
- **Availability Calendar**: Players mark when they're free on designated play days
- **Smart Suggestions**: Dates ranked by player availability
- **Easy Invites**: Share a simple invite link to add players
- **Calendar Export**: Export sessions to Google Calendar or download .ics files

## Tech Stack

- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- NextAuth.js (Google & Discord OAuth)
- Supabase (PostgreSQL)

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

**Google:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add `http://localhost:3000/api/auth/callback/google` as authorized redirect URI

**Discord:**
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to OAuth2 > General
4. Add `http://localhost:3000/api/auth/callback/discord` as redirect URI
5. Copy Client ID and Client Secret

### 4. Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase "perishable" key (safe for browser)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase "secret" key (server-side only, never expose)
- `NEXTAUTH_URL` - Your app URL (http://localhost:3000 for dev)
- `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - From Google Cloud Console
- `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` - From Discord Developer Portal

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
│   ├── api/auth/          # NextAuth.js API routes
│   ├── dashboard/         # User dashboard
│   ├── games/             # Game pages (create, view, join)
│   ├── login/             # Login page
│   └── settings/          # User settings
├── components/
│   ├── calendar/          # Availability calendar
│   ├── games/             # Game-related components
│   ├── layout/            # Navbar, Providers
│   └── ui/                # Reusable UI components
├── lib/
│   ├── auth.ts            # NextAuth configuration
│   ├── ics.ts             # Calendar export utilities
│   └── supabase.ts        # Supabase client
└── types/                 # TypeScript types
```

## License

MIT
