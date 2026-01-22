-- Migration: Default GM mode to true for all users
-- This migration:
-- 1. Updates all existing users to have is_gm = true
-- 2. Changes the default for the is_gm column to true

-- Update existing users
UPDATE users SET is_gm = true WHERE is_gm = false;

-- Change the column default
ALTER TABLE users ALTER COLUMN is_gm SET DEFAULT true;

-- Update the handle_new_user function to use true for is_gm
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
