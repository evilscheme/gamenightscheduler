-- Migration: Switch from NextAuth to Supabase Auth
-- Run this in the Supabase SQL Editor after enabling OAuth providers in the dashboard

-- ============================================
-- 1. Create trigger for auto-creating user profiles
-- ============================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create function to auto-create user profile on signup
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

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================
-- 2. Update RLS policies for member-only access
-- ============================================

-- Drop existing overly-permissive policies
DROP POLICY IF EXISTS "Anyone can view availability" ON availability;
DROP POLICY IF EXISTS "Anyone can view sessions" ON sessions;
DROP POLICY IF EXISTS "Anyone can view game memberships" ON game_memberships;

-- Availability: Only game participants can view
CREATE POLICY "Game participants can view availability" ON availability
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM games g
      LEFT JOIN game_memberships gm ON g.id = gm.game_id
      WHERE g.id = availability.game_id
      AND (g.gm_id = auth.uid() OR gm.user_id = auth.uid())
    )
  );

-- Sessions: Only game participants can view
CREATE POLICY "Game participants can view sessions" ON sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM games g
      LEFT JOIN game_memberships gm ON g.id = gm.game_id
      WHERE g.id = sessions.game_id
      AND (g.gm_id = auth.uid() OR gm.user_id = auth.uid())
    )
  );

-- Game memberships: Only members can see who else is in the game
CREATE POLICY "Members can view memberships" ON game_memberships
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM game_memberships gm
      WHERE gm.game_id = game_memberships.game_id AND gm.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM games WHERE id = game_memberships.game_id AND gm_id = auth.uid()
    )
  );


-- ============================================
-- 3. Notes for Supabase Dashboard Configuration
-- ============================================

-- After running this migration, you need to:
--
-- 1. Go to Authentication > Providers in Supabase Dashboard
--
-- 2. Enable Google OAuth:
--    - Toggle on "Google"
--    - Add your Google Client ID and Client Secret
--    - Authorized redirect URI: https://<project-ref>.supabase.co/auth/v1/callback
--
-- 3. Enable Discord OAuth:
--    - Toggle on "Discord"
--    - Add your Discord Client ID and Client Secret
--    - Authorized redirect URI: https://<project-ref>.supabase.co/auth/v1/callback
--
-- 4. Update your OAuth apps in Google Cloud Console and Discord Developer Portal:
--    - Add the Supabase callback URL as an authorized redirect URI
--    - For production, also add your production domain's callback
