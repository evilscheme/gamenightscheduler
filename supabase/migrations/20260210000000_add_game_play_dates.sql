-- Add ad_hoc_only column to games
ALTER TABLE games ADD COLUMN IF NOT EXISTS ad_hoc_only BOOLEAN NOT NULL DEFAULT false;

-- Create game_play_dates table
CREATE TABLE IF NOT EXISTS game_play_dates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 200),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_game_play_dates_game_id ON game_play_dates(game_id);
CREATE INDEX IF NOT EXISTS idx_game_play_dates_date ON game_play_dates(date);

-- RLS
ALTER TABLE game_play_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game participants can view play dates" ON game_play_dates
  FOR SELECT USING (public.is_game_participant(game_id, (select auth.uid())));
CREATE POLICY "GMs and co-GMs can insert play dates" ON game_play_dates
  FOR INSERT WITH CHECK (public.is_game_gm_or_co_gm(game_id, (select auth.uid())));
CREATE POLICY "GMs and co-GMs can update play dates" ON game_play_dates
  FOR UPDATE USING (public.is_game_gm_or_co_gm(game_id, (select auth.uid())));
CREATE POLICY "GMs and co-GMs can delete play dates" ON game_play_dates
  FOR DELETE USING (public.is_game_gm_or_co_gm(game_id, (select auth.uid())));
