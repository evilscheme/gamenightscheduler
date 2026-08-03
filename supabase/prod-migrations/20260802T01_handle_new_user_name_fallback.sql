-- handle_new_user(): never let a blank display name reach users.name.
--
-- Follow-up to 20260709T01. That migration made the trigger sanitize the
-- avatar and truncate over-long names, but the name COALESCE chain still only
-- skipped NULL candidates. A provider sending "full_name": "" — or an address
-- with no local part — therefore produced an empty-string name, which NOT NULL
-- accepts and every UI then renders as a nameless player. When the email was
-- also absent the same chain produced NULL and aborted the entire GoTrue signup
-- transaction (23502), which is how this surfaced: three failed sign-ups on
-- 2026-08-02 from a Discord account with no email address.
--
-- NULLIF each candidate so blanks fall through, and add a last-resort literal
-- so the chain cannot yield NULL regardless of what a provider sends.
--
-- email stays NOT NULL and undefended on purpose: Supabase Auth's Discord
-- "allow users without email" setting is off, so GoTrue rejects an email-less
-- OAuth account before this trigger runs.
--
-- Pre-flight: none — the new chain is strictly more permissive than the old one
-- and existing rows are untouched.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
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

-- CREATE OR REPLACE preserves the existing ACL, but re-assert the lockdown so
-- this file leaves the same grant state as schema.sql: the trigger fires via
-- the table's trigger machinery, so no client role needs EXECUTE.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
