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
  name TEXT NOT NULL,
  avatar_url TEXT,
  is_gm BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Games table
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  gm_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  play_days INTEGER[] NOT NULL DEFAULT '{}',
  invite_code TEXT UNIQUE NOT NULL,
  scheduling_window_months INTEGER DEFAULT 2 CHECK (scheduling_window_months BETWEEN 1 AND 3),
  default_start_time TIME DEFAULT '18:00',
  default_end_time TIME DEFAULT '22:00',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Game Membership table
CREATE TABLE game_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_id, date)
);

-- Sessions (Scheduled Game Nights) table
CREATE TYPE session_status AS ENUM ('suggested', 'confirmed', 'cancelled');

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  status session_status DEFAULT 'suggested',
  confirmed_by UUID REFERENCES users(id),
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
CREATE INDEX idx_availability_game_id ON availability(game_id);
CREATE INDEX idx_availability_user_id ON availability(user_id);
CREATE INDEX idx_availability_date ON availability(date);
CREATE INDEX idx_sessions_game_id ON sessions(game_id);
CREATE INDEX idx_sessions_date ON sessions(date);

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
$$ LANGUAGE plpgsql;

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url, is_gm)
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
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is a game participant (used by RLS policies)
CREATE OR REPLACE FUNCTION public.is_game_participant(game_id_param UUID, user_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM games WHERE id = game_id_param AND gm_id = user_id_param
  ) OR EXISTS (
    SELECT 1 FROM game_memberships WHERE game_id = game_id_param AND user_id = user_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  FOR UPDATE USING (auth.uid() = id);

-- Games policies
CREATE POLICY "Users can view games they are part of" ON games
  FOR SELECT USING (public.is_game_participant(id, auth.uid()));
CREATE POLICY "GMs can insert games" ON games
  FOR INSERT WITH CHECK (auth.uid() = gm_id);
CREATE POLICY "GMs can update own games" ON games
  FOR UPDATE USING (auth.uid() = gm_id);
CREATE POLICY "GMs can delete own games" ON games
  FOR DELETE USING (auth.uid() = gm_id);

-- Game memberships policies (uses helper function to avoid recursion)
CREATE POLICY "Members can view memberships" ON game_memberships
  FOR SELECT USING (public.is_game_participant(game_id, auth.uid()));
CREATE POLICY "Users can join games" ON game_memberships
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave games" ON game_memberships
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "GMs can remove players" ON game_memberships
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM games WHERE id = game_id AND gm_id = auth.uid())
  );

-- Availability policies
CREATE POLICY "Game participants can view availability" ON availability
  FOR SELECT USING (public.is_game_participant(game_id, auth.uid()));
CREATE POLICY "Users can insert own availability" ON availability
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own availability" ON availability
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own availability" ON availability
  FOR DELETE USING (auth.uid() = user_id);

-- Sessions policies
CREATE POLICY "Game participants can view sessions" ON sessions
  FOR SELECT USING (public.is_game_participant(game_id, auth.uid()));
CREATE POLICY "GMs can insert sessions" ON sessions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM games WHERE id = game_id AND gm_id = auth.uid())
  );
CREATE POLICY "GMs can update sessions" ON sessions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM games WHERE id = game_id AND gm_id = auth.uid())
  );
CREATE POLICY "GMs can delete sessions" ON sessions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM games WHERE id = game_id AND gm_id = auth.uid())
  );
