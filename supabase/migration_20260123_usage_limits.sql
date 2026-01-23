-- Migration: Add usage limits to prevent abuse
-- Date: 2026-01-23
--
-- This migration adds:
-- 1. Text field length constraints (game name, description, user display name)
-- 2. Functions for counting games per user, players per game, and future sessions
-- 3. Updated RLS policies to enforce usage limits

-- ============================================
-- 1. Add CHECK constraints for text field lengths
-- ============================================

-- Add CHECK constraint for user display name (50 chars max)
ALTER TABLE users
  ADD CONSTRAINT users_name_length CHECK (char_length(name) <= 50);

-- Add CHECK constraint for game name (100 chars max)
ALTER TABLE games
  ADD CONSTRAINT games_name_length CHECK (char_length(name) <= 100);

-- Add CHECK constraint for game description (1000 chars max)
ALTER TABLE games
  ADD CONSTRAINT games_description_length CHECK (description IS NULL OR char_length(description) <= 1000);

-- ============================================
-- 2. Add helper functions for counting
-- ============================================

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
-- 3. Update RLS policies to enforce limits
-- ============================================

-- Drop and recreate the games INSERT policy with limit check
DROP POLICY IF EXISTS "GMs can insert games" ON games;
CREATE POLICY "GMs can insert games" ON games
  FOR INSERT WITH CHECK (
    (select auth.uid()) = gm_id
    AND public.count_user_games((select auth.uid())) < 20
  );

-- Drop and recreate the game_memberships INSERT policy with limit check
DROP POLICY IF EXISTS "Users can join games" ON game_memberships;
CREATE POLICY "Users can join games" ON game_memberships
  FOR INSERT WITH CHECK (
    (select auth.uid()) = user_id
    AND public.count_game_players(game_id) < 50
  );

-- Drop and recreate the sessions INSERT policy with date and limit checks
DROP POLICY IF EXISTS "GMs and co-GMs can insert sessions" ON sessions;
CREATE POLICY "GMs and co-GMs can insert sessions" ON sessions
  FOR INSERT WITH CHECK (
    public.is_game_gm_or_co_gm(game_id, (select auth.uid()))
    AND date >= CURRENT_DATE
    AND public.count_future_sessions(game_id) < 100
  );
