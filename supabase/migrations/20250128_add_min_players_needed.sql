-- Add minimum players needed column to games table
-- This allows GMs to set a threshold for how many players are needed to play

ALTER TABLE games
ADD COLUMN min_players_needed INTEGER DEFAULT 0 CHECK (min_players_needed >= 0);

-- Add a comment explaining the column
COMMENT ON COLUMN games.min_players_needed IS 'Minimum number of available players needed to schedule a session. 0 means no minimum.';
