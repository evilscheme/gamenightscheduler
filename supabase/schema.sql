-- D&D Scheduler Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  is_gm BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Games (Campaigns) table
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  gm_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  play_days INTEGER[] NOT NULL DEFAULT '{}',
  invite_code TEXT UNIQUE NOT NULL,
  scheduling_window_months INTEGER DEFAULT 2 CHECK (scheduling_window_months BETWEEN 1 AND 3),
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

-- Availability table
CREATE TABLE availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
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
  status session_status DEFAULT 'suggested',
  confirmed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, date)
);

-- Indexes for performance
CREATE INDEX idx_games_gm_id ON games(gm_id);
CREATE INDEX idx_games_invite_code ON games(invite_code);
CREATE INDEX idx_game_memberships_game_id ON game_memberships(game_id);
CREATE INDEX idx_game_memberships_user_id ON game_memberships(user_id);
CREATE INDEX idx_availability_game_id ON availability(game_id);
CREATE INDEX idx_availability_user_id ON availability(user_id);
CREATE INDEX idx_availability_date ON availability(date);
CREATE INDEX idx_sessions_game_id ON sessions(game_id);
CREATE INDEX idx_sessions_date ON sessions(date);

-- Row Level Security (RLS) policies

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Users: Anyone can read, only own record can be updated
CREATE POLICY "Users are viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own record" ON users FOR UPDATE USING (true);
CREATE POLICY "Service role can insert users" ON users FOR INSERT WITH CHECK (true);

-- Games: Members can view, GMs can modify
CREATE POLICY "Games viewable by members" ON games FOR SELECT USING (true);
CREATE POLICY "GMs can insert games" ON games FOR INSERT WITH CHECK (true);
CREATE POLICY "GMs can update own games" ON games FOR UPDATE USING (true);
CREATE POLICY "GMs can delete own games" ON games FOR DELETE USING (true);

-- Game Memberships
CREATE POLICY "Memberships viewable by all" ON game_memberships FOR SELECT USING (true);
CREATE POLICY "Anyone can join games" ON game_memberships FOR INSERT WITH CHECK (true);
CREATE POLICY "Members can leave games" ON game_memberships FOR DELETE USING (true);

-- Availability
CREATE POLICY "Availability viewable by game members" ON availability FOR SELECT USING (true);
CREATE POLICY "Users can manage own availability" ON availability FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own availability" ON availability FOR UPDATE USING (true);
CREATE POLICY "Users can delete own availability" ON availability FOR DELETE USING (true);

-- Sessions
CREATE POLICY "Sessions viewable by game members" ON sessions FOR SELECT USING (true);
CREATE POLICY "GMs can manage sessions" ON sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "GMs can update sessions" ON sessions FOR UPDATE USING (true);
CREATE POLICY "GMs can delete sessions" ON sessions FOR DELETE USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for availability updated_at
CREATE TRIGGER update_availability_updated_at
  BEFORE UPDATE ON availability
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
