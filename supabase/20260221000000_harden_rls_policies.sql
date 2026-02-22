-- RLS Security Hardening Migration
-- Fixes findings from RLS audit: #10, #1, #2, #3, #11
-- Apply to production with: psql $DATABASE_URL -f supabase/20260221000000_harden_rls_policies.sql
-- After applying, delete this file (do not commit alongside schema.sql changes).

BEGIN;

-- ============================================
-- #10 (High): Protect is_admin from privilege escalation
-- Users could set is_admin=true on themselves via direct REST API.
-- A BEFORE UPDATE trigger silently resets is_admin if changed by non-admin.
-- ============================================

CREATE OR REPLACE FUNCTION public.protect_user_admin_flag()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    -- NULL auth.uid() = service role (admin client), which is allowed
    IF (SELECT auth.uid()) IS NOT NULL AND NOT OLD.is_admin THEN
      NEW.is_admin := OLD.is_admin;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS protect_admin_flag ON users;
CREATE TRIGGER protect_admin_flag
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_admin_flag();

-- ============================================
-- #1 (Medium): Add explicit deny policies for users INSERT/DELETE
-- These operations are handled by trigger and admin API respectively.
-- ============================================

DROP POLICY IF EXISTS "Users cannot directly insert" ON users;
CREATE POLICY "Users cannot directly insert" ON users
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "Users cannot directly delete" ON users;
CREATE POLICY "Users cannot directly delete" ON users
  FOR DELETE USING (false);

-- ============================================
-- #2 (Medium): availability INSERT must verify game membership
-- Without this, any authenticated user with a game_id UUID could
-- insert availability rows for games they haven't joined.
-- ============================================

DROP POLICY IF EXISTS "Users can insert own availability" ON availability;
CREATE POLICY "Users can insert own availability" ON availability
  FOR INSERT WITH CHECK (
    (select auth.uid()) = user_id
    AND public.is_game_participant(game_id, (select auth.uid()))
  );

-- ============================================
-- #3 (Medium): availability UPDATE must verify game membership
-- Without this, a user removed from a game could still update
-- their stale availability rows.
-- ============================================

DROP POLICY IF EXISTS "Users can update own availability" ON availability;
CREATE POLICY "Users can update own availability" ON availability
  FOR UPDATE USING (
    (select auth.uid()) = user_id
    AND public.is_game_participant(game_id, (select auth.uid()))
  );

-- ============================================
-- #11 (Medium): game_memberships UPDATE needs WITH CHECK
-- Without WITH CHECK, a GM could theoretically change game_id
-- on a membership row, moving a player to a different game.
-- ============================================

DROP POLICY IF EXISTS "GMs can update memberships" ON game_memberships;
CREATE POLICY "GMs can update memberships" ON game_memberships
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.games WHERE id = game_id AND gm_id = (select auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.games WHERE id = game_id AND gm_id = (select auth.uid()))
  );

-- Trigger to prevent game_id mutation on membership rows entirely
-- (WITH CHECK alone doesn't prevent moves between games owned by the same GM)
CREATE OR REPLACE FUNCTION public.prevent_membership_game_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.game_id IS DISTINCT FROM OLD.game_id THEN
    RAISE EXCEPTION 'Cannot change game_id on membership rows';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

DROP TRIGGER IF EXISTS prevent_membership_game_id_change ON game_memberships;
CREATE TRIGGER prevent_membership_game_id_change
  BEFORE UPDATE ON game_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_membership_game_change();

COMMIT;
