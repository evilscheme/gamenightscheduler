-- Migration: Allow GMs to remove players from their games
-- Date: 2026-01-16

-- Add RLS policy for GMs to remove players from their games
CREATE POLICY "GMs can remove players" ON game_memberships
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM games WHERE id = game_id AND gm_id = auth.uid())
  );
