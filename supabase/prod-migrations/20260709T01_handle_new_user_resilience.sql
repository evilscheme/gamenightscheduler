-- P6.1: signup resilience (see docs/plans/2026-07-06-architecture-remediation-plan.md)
--
-- 1. Widen the avatar host allowlist to legacy Google CDN hosts (lh4/lh5/lh6).
-- 2. handle_new_user() sanitizes (truncate name to 50, null non-allowlisted
--    avatars) instead of letting a users CHECK violation abort the entire auth
--    signup transaction.
--
-- Pre-flight: none needed — the new CHECK is strictly weaker than the old one.

BEGIN;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_avatar_url_check;
ALTER TABLE public.users ADD CONSTRAINT users_avatar_url_check CHECK (
  avatar_url IS NULL
  OR avatar_url ~ '^https://(lh[0-9]+\.googleusercontent\.com|cdn\.discordapp\.com|avatars\.githubusercontent\.com)/'
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  -- Sanitize inputs instead of letting public.users CHECK constraints reject
  -- the row: this trigger runs inside the auth signup transaction, so a
  -- constraint violation here turns a validation rule into a signup outage
  -- (OAuth name >50 chars, avatar from an unexpected host).
  v_name TEXT := left(
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    50
  );
  v_avatar TEXT := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );
BEGIN
  -- Must mirror the users.avatar_url CHECK; drop rather than reject.
  IF v_avatar IS NOT NULL
     AND v_avatar !~ '^https://(lh[0-9]+\.googleusercontent\.com|cdn\.discordapp\.com|avatars\.githubusercontent\.com)/' THEN
    v_avatar := NULL;
  END IF;

  INSERT INTO public.users (id, email, name, avatar_url, is_gm, is_admin)
  VALUES (NEW.id, NEW.email, v_name, v_avatar, true, false);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

COMMIT;
