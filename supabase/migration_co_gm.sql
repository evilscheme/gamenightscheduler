-- Co-GM Feature Migration
-- Run this migration on existing databases

-- ============================================
-- 1. Add is_co_gm column to game_memberships
-- ============================================

ALTER TABLE game_memberships ADD COLUMN IF NOT EXISTS is_co_gm BOOLEAN DEFAULT FALSE NOT NULL;

-- Index for efficient co-GM lookups
CREATE INDEX IF NOT EXISTS idx_game_memberships_co_gm ON game_memberships(game_id) WHERE is_co_gm = TRUE;

-- ============================================
-- 2. Helper function to check GM or co-GM status
-- ============================================

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

-- ============================================
-- 3. Update RLS policies for games table
-- ============================================

-- Drop existing update policy
DROP POLICY IF EXISTS "GMs can update own games" ON games;

-- Create new update policy that allows co-GMs
CREATE POLICY "GMs and co-GMs can update games" ON games
  FOR UPDATE USING (public.is_game_gm_or_co_gm(id, (select auth.uid())));

-- Note: DELETE policy stays GM-only (existing policy is fine)

-- ============================================
-- 4. Update RLS policies for sessions table
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "GMs can insert sessions" ON sessions;
DROP POLICY IF EXISTS "GMs can update sessions" ON sessions;
DROP POLICY IF EXISTS "GMs can delete sessions" ON sessions;

-- Create new policies that allow co-GMs
CREATE POLICY "GMs and co-GMs can insert sessions" ON sessions
  FOR INSERT WITH CHECK (public.is_game_gm_or_co_gm(game_id, (select auth.uid())));

CREATE POLICY "GMs and co-GMs can update sessions" ON sessions
  FOR UPDATE USING (public.is_game_gm_or_co_gm(game_id, (select auth.uid())));

CREATE POLICY "GMs and co-GMs can delete sessions" ON sessions
  FOR DELETE USING (public.is_game_gm_or_co_gm(game_id, (select auth.uid())));

-- ============================================
-- 5. Update RLS policies for game_memberships
-- ============================================

-- Drop existing delete policy
DROP POLICY IF EXISTS "Users or GMs can delete memberships" ON game_memberships;

-- Create new delete policy: users can leave, GMs can remove anyone, co-GMs can remove non-co-GMs
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

-- Add UPDATE policy for game_memberships (GM-only for toggling co-GM status)
CREATE POLICY "GMs can update memberships" ON game_memberships
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.games WHERE id = game_id AND gm_id = (select auth.uid()))
  );
