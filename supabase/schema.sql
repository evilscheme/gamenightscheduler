-- Can We Play? Database Schema
-- Run this in Supabase SQL Editor for a fresh install

-- ============================================
-- 1. Extensions
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 2. Tables
-- ============================================

-- Users table (linked to auth.users via id)
-- Column order and constraint names match the production database (pg_dump
-- emits attnum order, and db:drift diffs the dumps — cosmetic divergence here
-- would read as drift).
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL CONSTRAINT users_name_length CHECK (char_length(name) <= 50),
  avatar_url TEXT CHECK (
    avatar_url IS NULL
    OR avatar_url ~ '^https://(lh[0-9]+\.googleusercontent\.com|cdn\.discordapp\.com|avatars\.githubusercontent\.com)/'
  ),
  is_gm BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_admin BOOLEAN DEFAULT FALSE,
  -- Shape check, not a zone lookup: see games_timezone_shape.
  timezone TEXT DEFAULT NULL CONSTRAINT users_timezone_shape CHECK (
    timezone IS NULL OR timezone ~ '^[A-Za-z0-9_+/-]{1,64}$'
  ),
  week_start_day INTEGER DEFAULT 0 CHECK (week_start_day IN (0, 1)),
  time_format TEXT DEFAULT '12h' CHECK (time_format IN ('12h', '24h'))
);

-- Games table
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL CONSTRAINT games_name_length CHECK (char_length(name) <= 100),
  description TEXT CONSTRAINT games_description_length CHECK (description IS NULL OR char_length(description) <= 1000),
  gm_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  play_days INTEGER[] NOT NULL DEFAULT '{}' CHECK (play_days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]),
  invite_code TEXT UNIQUE NOT NULL,
  scheduling_window_months INTEGER DEFAULT 2 CHECK (scheduling_window_months IN (1, 2, 3, 6, 12)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  default_start_time TIME DEFAULT '18:00',
  default_end_time TIME DEFAULT '22:00',
  -- Conservative IANA *shape* (mirrored by TIMEZONE_SHAPE in src/lib/timezone.ts),
  -- deliberately not a lookup in pg_timezone_names: Postgres's and browsers'
  -- zone lists differ, and a strict lookup could reject a zone a real browser
  -- reports. It keeps CR/LF, ':' and ';' out (the value is interpolated into
  -- iCalendar feeds); a well-shaped unknown zone is handled by the client
  -- guards and game_today()'s UTC fallback. In a Postgres ARE '$' matches only
  -- at the very end of the string, so a trailing newline is rejected too.
  timezone TEXT DEFAULT 'America/Los_Angeles' CONSTRAINT games_timezone_shape CHECK (
    timezone IS NULL OR timezone ~ '^[A-Za-z0-9_+/-]{1,64}$'
  ),
  min_players_needed INTEGER DEFAULT 0 CHECK (min_players_needed >= 0),
  ad_hoc_only BOOLEAN NOT NULL DEFAULT false,
  campaign_start_date DATE DEFAULT NULL,
  campaign_end_date DATE DEFAULT NULL,
  CONSTRAINT valid_campaign_dates CHECK (
    campaign_end_date IS NULL OR campaign_start_date IS NULL
    OR campaign_end_date >= campaign_start_date
  )
);

-- Game Membership table
CREATE TABLE game_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  is_co_gm BOOLEAN DEFAULT FALSE NOT NULL,
  UNIQUE(game_id, user_id)
);

-- Availability status enum
CREATE TYPE availability_status AS ENUM ('available', 'unavailable', 'maybe');

-- Availability table
CREATE TABLE availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status availability_status NOT NULL DEFAULT 'available',
  comment TEXT CHECK (comment IS NULL OR char_length(comment) <= 500),
  available_after TIME,
  available_until TIME,
  UNIQUE(user_id, game_id, date)
);

-- User-level default (recurring weekly) availability.
-- One row per weekday the user has configured; no row = "no default" for that weekday.
CREATE TABLE user_availability_defaults (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun … 6=Sat
  status availability_status NOT NULL,
  comment TEXT CHECK (comment IS NULL OR char_length(comment) <= 500),
  available_after TIME,
  available_until TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, day_of_week)
);

-- Sessions (Scheduled Game Nights) table
-- Note: Sessions are always created as 'confirmed' and cancelled by deletion.
-- The 'suggested' and 'cancelled' values existed historically but were never used.
CREATE TYPE session_status AS ENUM ('confirmed');

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status session_status DEFAULT 'confirmed',
  confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  start_time TIME,
  end_time TIME,
  location TEXT CHECK (location IS NULL OR char_length(location) <= 200),
  notes    TEXT CHECK (notes    IS NULL OR char_length(notes)    <= 500),
  UNIQUE(game_id, date)
);

-- Game Play Dates table (normalized special play dates with optional notes)
CREATE TABLE game_play_dates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 200),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, date)
);

-- Admin platform-health history. One row per UTC day: how many users and games were
-- in each health bucket at the end of that day. Buckets are defined and computed in
-- TypeScript (HealthBucket in src/lib/admin/platformHealth.ts), so rows are written by
-- the app, never by SQL. Dormant games and churned users aren't stored: they're the
-- remainder, total minus the tracked buckets. `source` records whether the row was
-- captured near the day it describes ('snapshot') or rebuilt later from row timestamps
-- ('reconstructed' — undercounts anything deleted since, so treat it as approximate).
CREATE TABLE platform_daily_stats (
  day DATE PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('snapshot', 'reconstructed')),
  total_users INTEGER NOT NULL,
  healthy_booked_users INTEGER NOT NULL,
  healthy_viable_users INTEGER NOT NULL,
  getting_going_users INTEGER NOT NULL,
  unhealthy_users INTEGER NOT NULL,
  total_games INTEGER NOT NULL,
  healthy_booked_games INTEGER NOT NULL,
  healthy_viable_games INTEGER NOT NULL,
  getting_going_games INTEGER NOT NULL,
  unhealthy_games INTEGER NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Append-only deletion records, written by the log_deletion() trigger. Deletes are
-- otherwise invisible: nothing in the schema soft-deletes. Deliberately anonymous —
-- no ids, names or anything a user wrote; only counts, day-precision dates and flags
-- (docs/adr/0001-deletion-records-stay-anonymous.md). `cascaded` is TRUE when the row
-- went because its parent did (a game's sessions when the game is deleted), so charts
-- can count the deliberate action once instead of once per child row.
--   actor   who did it, as a role: 'self' (a player leaving), 'gm' (a host or co-GM),
--           'system' (nobody signed in: the account-deletion flow, admin tooling).
--   xact    the transaction the delete ran in. Records sharing one belong to the same
--           act, which is how an account deletion is tied to the games it took with it.
--   details facts about what was deleted; shape per entity in log_deletion(), read by
--           src/lib/admin/deletionRecords.ts.
-- All three are NULL on records from before 2026-11, which kept no facts.
CREATE TABLE deletion_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity TEXT NOT NULL CHECK (entity IN ('user', 'game', 'session', 'membership')),
  cascaded BOOLEAN NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor TEXT CHECK (actor IN ('self', 'gm', 'system')),
  xact BIGINT,
  details JSONB
);

-- ============================================
-- 3. Indexes
-- ============================================

CREATE INDEX idx_games_gm_id ON games(gm_id);
CREATE INDEX idx_games_invite_code ON games(invite_code);
CREATE INDEX idx_game_memberships_game_id ON game_memberships(game_id);
CREATE INDEX idx_game_memberships_user_id ON game_memberships(user_id);
CREATE INDEX idx_game_memberships_co_gm ON game_memberships(game_id) WHERE is_co_gm = TRUE;
CREATE INDEX idx_availability_game_id ON availability(game_id);
CREATE INDEX idx_availability_user_id ON availability(user_id);
CREATE INDEX idx_availability_date ON availability(date);
CREATE INDEX idx_sessions_game_id ON sessions(game_id);
CREATE INDEX idx_sessions_date ON sessions(date);
CREATE INDEX idx_sessions_confirmed_by ON sessions(confirmed_by);
CREATE INDEX idx_game_play_dates_game_id ON game_play_dates(game_id);
CREATE INDEX idx_game_play_dates_date ON game_play_dates(date);
CREATE INDEX idx_deletion_log_deleted_at ON deletion_log(deleted_at);

-- ============================================
-- 4. Functions
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  -- Sanitize inputs instead of letting public.users constraints reject the
  -- row: this trigger runs inside the auth signup transaction, so a violation
  -- here turns a validation rule into a signup outage (OAuth name >50 chars,
  -- avatar from an unexpected host, provider sending a blank display name).
  --
  -- NULLIF on each candidate matters: COALESCE only skips NULL, so a provider
  -- that sends "full_name": "" (or an address with no local part) otherwise
  -- lands an empty string in users.name, which NOT NULL happily accepts.
  --
  -- email is deliberately NOT defended here. Supabase Auth guarantees it:
  -- the Discord provider's "allow users without email" setting is off, so
  -- GoTrue rejects an email-less OAuth account before this trigger runs. That
  -- guarantee lives in dashboard config that neither this file nor db:drift
  -- can see — if signups start failing on users_email_key or a NOT NULL
  -- violation, check that setting before looking anywhere else.
  v_name TEXT := left(
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
      'Player'
    ),
    50
  );
  v_avatar TEXT := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );
BEGIN
  -- Must mirror the users.avatar_url CHECK; drop rather than reject.
  IF v_avatar IS NOT NULL
     AND v_avatar !~ '^https://(lh[0-9]+\.googleusercontent\.com|cdn\.discordapp\.com|avatars\.githubusercontent\.com)/' THEN
    v_avatar := NULL;
  END IF;

  INSERT INTO public.users (id, email, name, avatar_url, is_gm, is_admin)
  VALUES (NEW.id, NEW.email, v_name, v_avatar, true, false);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Check if user is a game participant (used by RLS policies)
CREATE OR REPLACE FUNCTION public.is_game_participant(game_id_param UUID, user_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.games WHERE id = game_id_param AND gm_id = user_id_param
  ) OR EXISTS (
    SELECT 1 FROM public.game_memberships WHERE game_id = game_id_param AND user_id = user_id_param
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- Check if user is GM or co-GM (used by RLS policies)
CREATE OR REPLACE FUNCTION public.is_game_gm_or_co_gm(game_id_param UUID, user_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user is the original GM
  IF EXISTS (SELECT 1 FROM public.games WHERE id = game_id_param AND gm_id = user_id_param) THEN
    RETURN TRUE;
  END IF;
  -- Check if user is a co-GM
  RETURN EXISTS (
    SELECT 1 FROM public.game_memberships
    WHERE game_id = game_id_param AND user_id = user_id_param AND is_co_gm = TRUE
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- Check if a membership is for a co-GM (used by RLS policies to determine removal permissions)
CREATE OR REPLACE FUNCTION public.is_membership_co_gm(membership_game_id UUID, membership_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.game_memberships
    WHERE game_id = membership_game_id AND user_id = membership_user_id AND is_co_gm = TRUE
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- Count how many games a user has created (used by RLS to enforce limit)
CREATE OR REPLACE FUNCTION public.count_user_games(user_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  game_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO game_count
  FROM public.games
  WHERE gm_id = user_id_param;
  RETURN game_count;
END;
-- VOLATILE (not STABLE): used in an INSERT ... WITH CHECK cap guard. A STABLE
-- count is evaluated once per statement, letting a bulk (multi-row) INSERT
-- bypass the limit; VOLATILE re-checks as rows accumulate. See
-- e2e/tests/rls/usage-limits-bulk.spec.ts.
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Count how many players are in a game (members + GM)
CREATE OR REPLACE FUNCTION public.count_game_players(game_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  member_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO member_count
  FROM public.game_memberships
  WHERE game_id = game_id_param;
  -- Add 1 for the GM (who is not in game_memberships)
  RETURN member_count + 1;
END;
-- VOLATILE (not STABLE): count-based limit guard; see count_user_games above.
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- "Today" as observed in the game's own timezone. Session dates are calendar
-- dates in the game's locale, so cutoffs computed with CURRENT_DATE (UTC on
-- Supabase) misclassify evenings near the UTC day boundary — "tonight" in a US
-- timezone was rejected as past after 00:00 UTC.
CREATE OR REPLACE FUNCTION public.game_today(game_id_param UUID)
RETURNS DATE AS $$
DECLARE
  tz TEXT;
BEGIN
  SELECT timezone INTO tz FROM public.games WHERE id = game_id_param;
  BEGIN
    RETURN (now() AT TIME ZONE COALESCE(tz, 'UTC'))::date;
  EXCEPTION WHEN OTHERS THEN
    -- Invalid IANA name stored on the game: fall back to UTC rather than
    -- making every session insert fail.
    RETURN (now() AT TIME ZONE 'UTC')::date;
  END;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- Last date a player can be offered for availability (and a GM for an extra
-- play date): the upper bound the availability and game_play_dates write
-- policies enforce. Mirrors the END of getSchedulingWindow()
-- (src/lib/schedule/scheduling.ts):
--   start = max(today, campaign_start_date)
--   end   = min(lastDayOfMonth(start + scheduling_window_months), campaign_end_date)
-- ad_hoc_only does not change the window (it only empties play_days).
--
-- "today" here is deliberately NOT game_today(): the client computes the window
-- from the VIEWER's local date, and the end is month-granular, so a viewer one
-- calendar day ahead of the game's zone on the last day of a month gets a
-- window a whole month longer. The policy must accept a superset of what any
-- client can offer, so this uses the latest local date anywhere on Earth: the
-- UTC date + 1 (UTC+14 is never more than one calendar day ahead of UTC). Month
-- arithmetic agrees with date-fns: both clamp Jan 31 + 1 month to Feb 28, and
-- only the month matters once it is rounded to the month's last day.
CREATE OR REPLACE FUNCTION public.game_window_end(game_id_param UUID)
RETURNS DATE AS $$
DECLARE
  v_months     INTEGER;
  v_start      DATE;
  v_end        DATE;
  v_months_end DATE;
BEGIN
  SELECT scheduling_window_months, campaign_start_date, campaign_end_date
    INTO v_months, v_start, v_end
    FROM public.games WHERE id = game_id_param;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  -- GREATEST/LEAST ignore NULLs: no campaign start/end means no clamp. A NULL
  -- window length (the column has a default but no NOT NULL) reads as the
  -- longest allowed, 12, so the backstop never undercuts the client.
  v_start := GREATEST((now() AT TIME ZONE 'UTC')::date + 1, v_start);
  v_months_end := (date_trunc('month', v_start + make_interval(months => COALESCE(v_months, 12)))
                   + interval '1 month' - interval '1 day')::date;
  RETURN LEAST(v_months_end, v_end);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- Count how many future sessions exist for a game (used by RLS to enforce limit)
CREATE OR REPLACE FUNCTION public.count_future_sessions(game_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  session_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO session_count
  FROM public.sessions
  WHERE game_id = game_id_param
    AND date >= public.game_today(game_id_param);
  RETURN session_count;
END;
-- VOLATILE (not STABLE): count-based limit guard; see count_user_games above.
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Check if the current user shares a game with the target user (used by users RLS)
CREATE OR REPLACE FUNCTION public.shares_game_with(target_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_uid UUID := (SELECT auth.uid());
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM (
      SELECT game_id FROM public.game_memberships WHERE user_id = current_uid
      UNION ALL
      SELECT id FROM public.games WHERE gm_id = current_uid
    ) my_games
    JOIN (
      SELECT game_id FROM public.game_memberships WHERE user_id = target_user_id
      UNION ALL
      SELECT id FROM public.games WHERE gm_id = target_user_id
    ) their_games ON my_games.game_id = their_games.game_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- Allowlist-based column protection for the users table.
-- Saves the values of allowed columns, resets the entire row to OLD,
-- then re-applies only the allowed columns. Any column not explicitly
-- listed here is frozen by default — including columns added in the future.
-- Service role (auth.uid() IS NULL) bypasses this for admin operations.
CREATE OR REPLACE FUNCTION public.protect_user_columns()
RETURNS TRIGGER AS $$
DECLARE
  -- Save allowlisted values before resetting
  v_name           TEXT          := NEW.name;
  v_avatar_url     TEXT          := NEW.avatar_url;
  v_timezone       TEXT          := NEW.timezone;
  v_week_start_day INTEGER       := NEW.week_start_day;
  v_time_format    TEXT          := NEW.time_format;
BEGIN
  -- Service role (NULL uid) can change anything
  IF (SELECT auth.uid()) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Reset ALL columns to old values
  NEW := OLD;

  -- Re-apply only the allowlisted columns
  NEW.name           := v_name;
  NEW.avatar_url     := v_avatar_url;
  NEW.timezone       := v_timezone;
  NEW.week_start_day := v_week_start_day;
  NEW.time_format    := v_time_format;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Prevent game_id from being changed on membership rows (blocks cross-game player moves)
-- Not SECURITY DEFINER: no privileged function calls needed, and this should also block service role
CREATE OR REPLACE FUNCTION public.prevent_membership_game_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.game_id IS DISTINCT FROM OLD.game_id THEN
    RAISE EXCEPTION 'Cannot change game_id on membership rows';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- Prevent gm_id from being changed by authenticated users (blocks game theft by co-GMs
-- and force-transfers by GMs). Service role (auth.uid() IS NULL) can still transfer
-- ownership for admin operations like account deletion.
CREATE OR REPLACE FUNCTION public.protect_game_gm_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.gm_id IS DISTINCT FROM OLD.gm_id THEN
    IF (SELECT auth.uid()) IS NOT NULL THEN
      NEW.gm_id := OLD.gm_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Join a game using its invite code (the ONLY path for a player to join).
-- This is the authorization boundary for joining: it verifies the invite code,
-- enforces the player cap, and always inserts as a regular player (is_co_gm = FALSE).
-- Routing joins through this function lets us close two critical holes that a direct
-- INSERT policy could not:
--   1. The invite code is a column on `games`, not `game_memberships`, so a row-level
--      INSERT policy can't require it. Here we look the game up BY the code.
--   2. A direct INSERT lets the client choose `is_co_gm`; here it is hard-coded false.
-- SECURITY DEFINER (runs as owner, bypassing RLS) because there is no direct INSERT
-- policy on game_memberships — this function is the only sanctioned insert path.
CREATE OR REPLACE FUNCTION public.join_game_by_invite(invite_code_param TEXT)
RETURNS UUID AS $$
DECLARE
  v_uid     UUID := (SELECT auth.uid());
  v_game_id UUID;
  v_gm_id   UUID;
BEGIN
  -- Must be authenticated.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Resolve the game by its invite code (the secret), not by a guessable id.
  SELECT id, gm_id INTO v_game_id, v_gm_id
  FROM public.games
  WHERE invite_code = invite_code_param;

  IF v_game_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code' USING ERRCODE = 'P0002';
  END IF;

  -- The GM already owns the game; nothing to do (avoids a phantom membership row).
  IF v_gm_id = v_uid THEN
    RETURN v_game_id;
  END IF;

  -- Enforce the same player cap the old INSERT policy did (members + GM).
  IF public.count_game_players(v_game_id) >= 50 THEN
    RAISE EXCEPTION 'Game is full' USING ERRCODE = 'P0001';
  END IF;

  -- Always join as a regular player. Co-GM is granted later by the GM via UPDATE.
  INSERT INTO public.game_memberships (game_id, user_id, is_co_gm)
  VALUES (v_game_id, v_uid, FALSE)
  ON CONFLICT (game_id, user_id) DO NOTHING;

  RETURN v_game_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Lock down execution: only signed-in users may call it (anon is rejected anyway,
-- but don't expose the endpoint). Revoke the default PUBLIC grant first.
REVOKE EXECUTE ON FUNCTION public.join_game_by_invite(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_game_by_invite(TEXT) TO authenticated;

-- BEFORE DELETE trigger body for deletion_log. BEFORE, not AFTER: the facts are counts
-- of the row's children, and the cascade that removes them runs ahead of any AFTER
-- trigger here. A child row counts as cascaded when its parent is already gone:
-- inside a cascading delete the parent row is no longer visible to the RI action
-- that removes the child, so NOT EXISTS is true exactly for cascade deletes. A user
-- row is never cascaded — account deletion is the act.
--
-- The facts stay anonymous (see the deletion_log comment): counts, flags, and dates
-- cut to the UTC day. A game's last_activity is the same set of timestamps as
-- gameActivity() in src/lib/admin/platformHealth.ts — change them together.
--
-- A membership removed because its user now hosts the game is an ownership transfer,
-- not a departure, and is not recorded. Account deletions always read 'system': the
-- auth service performs them with no signed-in user, whoever asked.
CREATE OR REPLACE FUNCTION public.log_deletion()
RETURNS TRIGGER AS $$
DECLARE
  v_entity TEXT;
  v_cascaded BOOLEAN := FALSE;
  v_uid UUID := auth.uid();
  v_actor TEXT;
  v_today DATE;
  v_details JSONB;
BEGIN
  v_actor := CASE WHEN v_uid IS NULL THEN 'system' ELSE 'gm' END;

  CASE TG_TABLE_NAME
    WHEN 'users' THEN
      v_entity := 'user';
      v_actor := 'system';
      v_details := jsonb_build_object(
        'created', (COALESCE(OLD.created_at, now()) AT TIME ZONE 'UTC')::date,
        'games_hosted', (SELECT count(*) FROM public.games WHERE gm_id = OLD.id),
        'games_joined', (SELECT count(*) FROM public.game_memberships WHERE user_id = OLD.id),
        'availability_entries', (SELECT count(*) FROM public.availability WHERE user_id = OLD.id)
      );
    WHEN 'games' THEN
      v_entity := 'game';
      v_cascaded := NOT EXISTS (SELECT 1 FROM public.users WHERE id = OLD.gm_id);
      v_today := public.game_today(OLD.id);
      v_details := jsonb_build_object(
        'created', (COALESCE(OLD.created_at, now()) AT TIME ZONE 'UTC')::date,
        'players', 1 + (SELECT count(*) FROM public.game_memberships WHERE game_id = OLD.id),
        'sessions_past', (SELECT count(*) FROM public.sessions WHERE game_id = OLD.id AND date < v_today),
        'sessions_upcoming', (SELECT count(*) FROM public.sessions WHERE game_id = OLD.id AND date >= v_today),
        'availability_entries', (SELECT count(*) FROM public.availability WHERE game_id = OLD.id),
        'extra_dates', (SELECT count(*) FROM public.game_play_dates WHERE game_id = OLD.id),
        'last_activity', (GREATEST(
          COALESCE(OLD.created_at, now()),
          (SELECT max(joined_at) FROM public.game_memberships WHERE game_id = OLD.id),
          (SELECT max(created_at) FROM public.sessions WHERE game_id = OLD.id),
          (SELECT max(GREATEST(created_at, updated_at)) FROM public.availability WHERE game_id = OLD.id),
          (SELECT max(created_at) FROM public.game_play_dates WHERE game_id = OLD.id)
        ) AT TIME ZONE 'UTC')::date
      );
    WHEN 'sessions' THEN
      v_entity := 'session';
      v_cascaded := NOT EXISTS (SELECT 1 FROM public.games WHERE id = OLD.game_id);
      v_details := jsonb_build_object(
        'created', (COALESCE(OLD.created_at, now()) AT TIME ZONE 'UTC')::date,
        'session_date', OLD.date,
        'days_until', OLD.date - public.game_today(OLD.game_id)
      );
    WHEN 'game_memberships' THEN
      IF EXISTS (SELECT 1 FROM public.games WHERE id = OLD.game_id AND gm_id = OLD.user_id) THEN
        RETURN OLD;
      END IF;
      v_entity := 'membership';
      v_cascaded := NOT EXISTS (SELECT 1 FROM public.games WHERE id = OLD.game_id)
        OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = OLD.user_id);
      IF v_uid = OLD.user_id THEN
        v_actor := 'self';
      END IF;
      v_details := jsonb_build_object(
        'joined', (COALESCE(OLD.joined_at, now()) AT TIME ZONE 'UTC')::date,
        'co_gm', OLD.is_co_gm,
        'availability_entries', (
          SELECT count(*) FROM public.availability WHERE game_id = OLD.game_id AND user_id = OLD.user_id
        )
      );
  END CASE;

  INSERT INTO public.deletion_log (entity, cascaded, actor, xact, details)
  VALUES (v_entity, v_cascaded, v_actor, txid_current(), v_details);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================
-- 5. Triggers
-- ============================================

-- Update availability timestamp on change
CREATE TRIGGER update_availability_updated_at
  BEFORE UPDATE ON availability
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_availability_defaults_updated_at
  BEFORE UPDATE ON user_availability_defaults
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create user profile when auth user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Freeze non-allowlisted columns (defense-in-depth for privilege escalation & future-proofing)
CREATE TRIGGER protect_user_columns
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_columns();

-- Prevent game_id from being changed on membership rows (blocks cross-game player moves)
CREATE TRIGGER prevent_membership_game_id_change
  BEFORE UPDATE ON game_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_membership_game_change();

-- Prevent gm_id changes on games (blocks co-GM game theft and GM force-transfers)
CREATE TRIGGER protect_game_gm_id
  BEFORE UPDATE OF gm_id ON games
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_game_gm_id();

-- Write a deletion record for every hard delete (admin Deletions chart and list).
-- BEFORE DELETE so the row's children are still there to count: see log_deletion().
CREATE TRIGGER log_user_deletion
  BEFORE DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION public.log_deletion();
CREATE TRIGGER log_game_deletion
  BEFORE DELETE ON games
  FOR EACH ROW EXECUTE FUNCTION public.log_deletion();
CREATE TRIGGER log_session_deletion
  BEFORE DELETE ON sessions
  FOR EACH ROW EXECUTE FUNCTION public.log_deletion();
CREATE TRIGGER log_membership_deletion
  BEFORE DELETE ON game_memberships
  FOR EACH ROW EXECUTE FUNCTION public.log_deletion();

-- ============================================
-- 6. Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users viewable by self or co-participants" ON users
  FOR SELECT USING (id = (SELECT auth.uid()) OR public.shares_game_with(id));
CREATE POLICY "Users can update own record" ON users
  FOR UPDATE USING ((select auth.uid()) = id);
-- Explicit deny: inserts handled only by handle_new_user() trigger
CREATE POLICY "Users cannot directly insert" ON users
  FOR INSERT WITH CHECK (false);
-- Explicit deny: deletes handled only by admin API with service role
CREATE POLICY "Users cannot directly delete" ON users
  FOR DELETE USING (false);

-- Games policies
CREATE POLICY "Users can view games they are part of" ON games
  FOR SELECT USING (public.is_game_participant(id, (select auth.uid())));
CREATE POLICY "GMs can insert games" ON games
  FOR INSERT WITH CHECK (
    (select auth.uid()) = gm_id
    AND public.count_user_games((select auth.uid())) < 20
  );
CREATE POLICY "GMs and co-GMs can update games" ON games
  FOR UPDATE USING (public.is_game_gm_or_co_gm(id, (select auth.uid())));
CREATE POLICY "GMs can delete own games" ON games
  FOR DELETE USING ((select auth.uid()) = gm_id);

-- Game memberships policies (uses helper function to avoid recursion)
CREATE POLICY "Members can view memberships" ON game_memberships
  FOR SELECT USING (public.is_game_participant(game_id, (select auth.uid())));
-- NOTE: There is deliberately NO direct INSERT policy for authenticated users.
-- A row-level INSERT policy cannot verify the invite code (it lives on `games`,
-- not `game_memberships`) and cannot stop a client from self-assigning
-- is_co_gm = TRUE. Both holes are closed by funneling all joins through the
-- SECURITY DEFINER function public.join_game_by_invite(), which is the only
-- sanctioned insert path. Service-role/admin operations bypass RLS as usual.
CREATE POLICY "Users, GMs, or co-GMs can delete memberships" ON game_memberships
  FOR DELETE USING (
    -- User can always remove themselves
    (select auth.uid()) = user_id OR
    -- GM can remove anyone
    EXISTS (SELECT 1 FROM public.games WHERE id = game_id AND gm_id = (select auth.uid())) OR
    -- Co-GM can remove non-co-GMs only (use SECURITY DEFINER functions to bypass RLS)
    (
      public.is_membership_co_gm(game_id, (select auth.uid())) AND  -- current user is a co-GM
      NOT public.is_membership_co_gm(game_id, user_id)              -- target is not a co-GM
    )
  );
CREATE POLICY "GMs can update memberships" ON game_memberships
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.games WHERE id = game_id AND gm_id = (select auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.games WHERE id = game_id AND gm_id = (select auth.uid()))
  );

-- User availability defaults policies
ALTER TABLE user_availability_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own availability defaults" ON user_availability_defaults
  FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert own availability defaults" ON user_availability_defaults
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update own availability defaults" ON user_availability_defaults
  FOR UPDATE USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete own availability defaults" ON user_availability_defaults
  FOR DELETE USING ((select auth.uid()) = user_id);

-- Date bounds on availability and game_play_dates writes. Without them any
-- signed-up user could create a game and bulk-insert rows for every date from
-- year 1 to 9999 (storage exhaustion, slow game loads, admin scans timing out).
-- The bound is what the UI can offer: not before today, not after the game's
-- scheduling window (game_window_end). Both ends are slightly lenient, because
-- the client decides "today" from the VIEWER's local date while the server only
-- knows UTC: the earliest local date anywhere is the UTC date - 1 (UTC-12), and
-- game_window_end already assumes the latest (UTC date + 1). The database is a
-- backstop against abuse, not the source of truth for the UI, so it must be a
-- superset of what the client offers, never a subset.
-- The bound lives in RLS, not a CHECK or trigger: a CHECK can't reference the
-- current date, and service-role seeds, E2E helpers and backfills legitimately
-- write historical rows (they bypass RLS).
-- The UPDATE policies carry an explicit WITH CHECK so a row can't be inserted in
-- range and then moved out of it. Consequence (intended): a row whose date has
-- passed, or that falls outside a window the GM later shortened, can no longer
-- be edited by its owner. It can still be read and deleted.

-- Availability policies
CREATE POLICY "Game participants can view availability" ON availability
  FOR SELECT USING (public.is_game_participant(game_id, (select auth.uid())));
CREATE POLICY "Users can insert own availability" ON availability
  FOR INSERT WITH CHECK (
    (select auth.uid()) = user_id
    AND public.is_game_participant(game_id, (select auth.uid()))
    AND date >= (now() AT TIME ZONE 'UTC')::date - 1
    AND date <= public.game_window_end(game_id)
  );
CREATE POLICY "Users can update own availability" ON availability
  FOR UPDATE USING (
    (select auth.uid()) = user_id
    AND public.is_game_participant(game_id, (select auth.uid()))
  )
  WITH CHECK (
    (select auth.uid()) = user_id
    AND public.is_game_participant(game_id, (select auth.uid()))
    AND date >= (now() AT TIME ZONE 'UTC')::date - 1
    AND date <= public.game_window_end(game_id)
  );
CREATE POLICY "Users can delete own availability" ON availability
  FOR DELETE USING ((select auth.uid()) = user_id);

-- Sessions policies
CREATE POLICY "Game participants can view sessions" ON sessions
  FOR SELECT USING (public.is_game_participant(game_id, (select auth.uid())));
CREATE POLICY "GMs and co-GMs can insert sessions" ON sessions
  FOR INSERT WITH CHECK (
    public.is_game_gm_or_co_gm(game_id, (select auth.uid()))
    AND date >= public.game_today(game_id)
    AND public.count_future_sessions(game_id) < 100
  );
CREATE POLICY "GMs and co-GMs can update sessions" ON sessions
  FOR UPDATE USING (public.is_game_gm_or_co_gm(game_id, (select auth.uid())));
CREATE POLICY "GMs and co-GMs can delete sessions" ON sessions
  FOR DELETE USING (public.is_game_gm_or_co_gm(game_id, (select auth.uid())));

-- Game play dates policies
ALTER TABLE game_play_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game participants can view play dates" ON game_play_dates
  FOR SELECT USING (public.is_game_participant(game_id, (select auth.uid())));
-- Same date bounds as availability (see the comment above its policies): the
-- calendar only lets a GM add an extra date, or edit a date's note, on a
-- non-past date inside the scheduling window.
CREATE POLICY "GMs and co-GMs can insert play dates" ON game_play_dates
  FOR INSERT WITH CHECK (
    public.is_game_gm_or_co_gm(game_id, (select auth.uid()))
    AND date >= (now() AT TIME ZONE 'UTC')::date - 1
    AND date <= public.game_window_end(game_id)
  );
CREATE POLICY "GMs and co-GMs can update play dates" ON game_play_dates
  FOR UPDATE USING (public.is_game_gm_or_co_gm(game_id, (select auth.uid())))
  WITH CHECK (
    public.is_game_gm_or_co_gm(game_id, (select auth.uid()))
    AND date >= (now() AT TIME ZONE 'UTC')::date - 1
    AND date <= public.game_window_end(game_id)
  );
CREATE POLICY "GMs and co-GMs can delete play dates" ON game_play_dates
  FOR DELETE USING (public.is_game_gm_or_co_gm(game_id, (select auth.uid())));

-- Admin-only tables: RLS on with no policies, so anon/authenticated see nothing.
-- Read and written only through the service-role admin client.
ALTER TABLE platform_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE deletion_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Data API role grants
-- ============================================================
-- Supabase CLI v2.106.0+ defaults [api].auto_expose_new_tables to false and
-- revokes the legacy default privileges on new public-schema objects. These
-- explicit grants restore the long-standing behavior this schema was built
-- against; row-level access is still enforced by the RLS policies above.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
-- Functions: authenticated + service_role only. anon is deliberately excluded so
-- the SECURITY DEFINER helpers (count_*, is_*, shares_game_with) and
-- join_game_by_invite are NOT callable as unauthenticated PostgREST RPCs.
-- RLS still works: authenticated holds EXECUTE, which is what policy evaluation needs.
-- Must REVOKE FROM both PUBLIC and anon explicitly (not just omit anon from the
-- GRANT ... TO list): every function in this file picks up TWO separate grants at
-- CREATE FUNCTION time — (1) Postgres's built-in default EXECUTE-to-PUBLIC (which every
-- role, including anon, inherits) and (2) an explicit anon grant from a pre-existing
-- default ACL this local Supabase CLI version seeds before this script runs. GRANT is
-- additive and never revokes an existing grant, so a positive-list GRANT alone leaves
-- both of those intact. Same pattern already used for join_game_by_invite above.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;

-- Trigger-only functions: revoke the authenticated EXECUTE the blanket grant above
-- just handed them. handle_new_user, protect_user_columns, and protect_game_gm_id
-- exist solely as triggers; a trigger fires via the table's trigger machinery,
-- which does NOT check the invoking role's EXECUTE grant, so no client role needs
-- it. Leaving the grant only lists them as authenticated-callable SECURITY DEFINER
-- RPCs in the Supabase advisor (lint 0029) for zero functional benefit. Revoking
-- removes them from the /rest/v1/rpc surface without affecting the triggers.
-- (join_game_by_invite is intentionally left callable — it IS a client RPC.)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_user_columns() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_game_gm_id() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_deletion() FROM authenticated;
