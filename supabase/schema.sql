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
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL CHECK (char_length(name) <= 50),
  avatar_url TEXT,
  is_gm BOOLEAN DEFAULT TRUE,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Games table
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL CHECK (char_length(name) <= 100),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 1000),
  gm_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  play_days INTEGER[] NOT NULL DEFAULT '{}',
  special_play_dates DATE[] NOT NULL DEFAULT '{}',
  invite_code TEXT UNIQUE NOT NULL,
  scheduling_window_months INTEGER DEFAULT 2 CHECK (scheduling_window_months BETWEEN 1 AND 3),
  default_start_time TIME DEFAULT '18:00',
  default_end_time TIME DEFAULT '22:00',
  timezone TEXT DEFAULT 'America/Los_Angeles',
  min_players_needed INTEGER DEFAULT 0 CHECK (min_players_needed >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Game Membership table
CREATE TABLE game_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_co_gm BOOLEAN DEFAULT FALSE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
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
  status availability_status NOT NULL DEFAULT 'available',
  comment TEXT,
  available_after TIME,
  available_until TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_id, date)
);

-- Sessions (Scheduled Game Nights) table
-- Note: Sessions are always created as 'confirmed' and cancelled by deletion.
-- The 'suggested' and 'cancelled' values existed historically but were never used.
CREATE TYPE session_status AS ENUM ('confirmed');

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  status session_status DEFAULT 'confirmed',
  confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, date)
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
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url, is_gm, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    ),
    true,
    false
  );
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Check if a membership is for a co-GM (used by RLS policies to determine removal permissions)
CREATE OR REPLACE FUNCTION public.is_membership_co_gm(membership_game_id UUID, membership_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.game_memberships
    WHERE game_id = membership_game_id AND user_id = membership_user_id AND is_co_gm = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Count how many future sessions exist for a game (used by RLS to enforce limit)
CREATE OR REPLACE FUNCTION public.count_future_sessions(game_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  session_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO session_count
  FROM public.sessions
  WHERE game_id = game_id_param
    AND date >= CURRENT_DATE;
  RETURN session_count;
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

-- Create user profile when auth user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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
CREATE POLICY "Users are viewable by everyone" ON users
  FOR SELECT USING (true);
CREATE POLICY "Users can update own record" ON users
  FOR UPDATE USING ((select auth.uid()) = id);

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
CREATE POLICY "Users can join games" ON game_memberships
  FOR INSERT WITH CHECK (
    (select auth.uid()) = user_id
    AND public.count_game_players(game_id) < 50
  );
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
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.games WHERE id = game_id AND gm_id = (select auth.uid()))
  );

-- Availability policies
CREATE POLICY "Game participants can view availability" ON availability
  FOR SELECT USING (public.is_game_participant(game_id, (select auth.uid())));
CREATE POLICY "Users can insert own availability" ON availability
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update own availability" ON availability
  FOR UPDATE USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete own availability" ON availability
  FOR DELETE USING ((select auth.uid()) = user_id);

-- Sessions policies
CREATE POLICY "Game participants can view sessions" ON sessions
  FOR SELECT USING (public.is_game_participant(game_id, (select auth.uid())));
CREATE POLICY "GMs and co-GMs can insert sessions" ON sessions
  FOR INSERT WITH CHECK (
    public.is_game_gm_or_co_gm(game_id, (select auth.uid()))
    AND date >= CURRENT_DATE
    AND public.count_future_sessions(game_id) < 100
  );
CREATE POLICY "GMs and co-GMs can update sessions" ON sessions
  FOR UPDATE USING (public.is_game_gm_or_co_gm(game_id, (select auth.uid())));
CREATE POLICY "GMs and co-GMs can delete sessions" ON sessions
  FOR DELETE USING (public.is_game_gm_or_co_gm(game_id, (select auth.uid())));
