-- handle_new_user(): restore text parity with schema.sql.
--
-- 20260802T01 applied the correct NULLIF logic, but wrote its rationale as SQL
-- comments ABOVE the CREATE statement instead of inside the function body.
-- Postgres stores the text between $$ ... $$ verbatim in pg_proc.prosrc and
-- pg_dump reproduces it byte for byte, so the comment block that lives in
-- schema.sql's DECLARE section was missing from prod and `npm run db:drift`
-- correctly flagged it.
--
-- This re-applies the function with the body copied verbatim from schema.sql.
-- No behavior change: the executable statements are identical to what
-- 20260802T01 already installed.
--
-- Pre-flight: none — CREATE OR REPLACE with an identical signature.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  -- Sanitize inputs instead of letting public.users constraints reject the
  -- row: this trigger runs inside the auth signup transaction, so a violation
  -- here turns a validation rule into a signup outage (OAuth name >50 chars,
  -- avatar from an unexpected host, provider sending a blank display name).
  --
  -- NULLIF on each candidate matters: COALESCE only skips NULL, so a provider
  -- that sends "full_name": "" (or an address with no local part) otherwise
  -- lands an empty string in users.name, which NOT NULL happily accepts.
  --
  -- email is deliberately NOT defended here. Supabase Auth guarantees it:
  -- the Discord provider's "allow users without email" setting is off, so
  -- GoTrue rejects an email-less OAuth account before this trigger runs. That
  -- guarantee lives in dashboard config that neither this file nor db:drift
  -- can see — if signups start failing on users_email_key or a NOT NULL
  -- violation, check that setting before looking anywhere else.
  v_name TEXT := left(
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
      'Player'
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

-- CREATE OR REPLACE preserves the existing ACL; re-assert the lockdown so this
-- file leaves the same grant state as schema.sql.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
