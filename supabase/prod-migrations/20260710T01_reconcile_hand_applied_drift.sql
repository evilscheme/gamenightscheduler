-- Reconcile historical hand-applied drift surfaced by the first db:drift run
-- (2026-07-10). Prod predates the schema.sql-as-source-of-truth era; this
-- brings it byte-parity with schema.sql. Each fix below names what drifted.
--
-- Pre-flights are built in (DO blocks that raise with guidance).

-- Pre-flight 1: the session_status enum shrink requires every row confirmed.
DO $pre$
DECLARE
  bad INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad FROM public.sessions WHERE status IS DISTINCT FROM 'confirmed';
  IF bad > 0 THEN
    RAISE EXCEPTION 'pre-flight failed: % session(s) have non-confirmed status — inspect: SELECT id, game_id, date, status FROM public.sessions WHERE status IS DISTINCT FROM ''confirmed'';', bad;
  END IF;
END;
$pre$;

-- Pre-flight 2: the users -> auth.users FK requires no orphaned profiles.
DO $pre$
DECLARE
  bad INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad
  FROM public.users u
  LEFT JOIN auth.users a ON a.id = u.id
  WHERE a.id IS NULL;
  IF bad > 0 THEN
    RAISE EXCEPTION 'pre-flight failed: % public.users row(s) have no auth.users row — inspect: SELECT u.id, u.email FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL;', bad;
  END IF;
END;
$pre$;

-- Drift 1 (CRITICAL): prod lacks the users -> auth.users cascade FK that
-- schema.sql has always declared inline. Account deletion deletes ONLY
-- auth.users and relies on this cascade; without it the profile survives.
DO $fix$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_constraint
    WHERE conname = 'users_id_fkey' AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END;
$fix$;

-- Drift 2: prod's session_status enum still carries the never-used historical
-- values ('suggested', 'cancelled') and defaults to 'suggested'. Shrink to
-- the canonical single value and default.
ALTER TABLE public.sessions ALTER COLUMN status DROP DEFAULT;
CREATE TYPE public.session_status_new AS ENUM ('confirmed');
ALTER TABLE public.sessions
  ALTER COLUMN status TYPE public.session_status_new
  USING (status::text::public.session_status_new);
DROP TYPE public.session_status;
ALTER TYPE public.session_status_new RENAME TO session_status;
ALTER TABLE public.sessions ALTER COLUMN status SET DEFAULT 'confirmed';

-- Drift 3: availability.status lost its default on prod.
ALTER TABLE public.availability ALTER COLUMN status SET DEFAULT 'available';

-- Drift 4: prod's users.id carries a spurious uuid default (ids always come
-- from auth.users via the signup trigger).
ALTER TABLE public.users ALTER COLUMN id DROP DEFAULT;

-- Drift 5: stray policy from an old hand-fix; service_role bypasses RLS, so
-- this granted nothing and schema.sql deliberately has no users INSERT policy
-- (inserts happen only via the SECURITY DEFINER signup trigger).
DROP POLICY IF EXISTS "service role can insert users" ON public.users;

-- Drift 6: function bodies on prod are semantically identical but textually
-- stale (older formatting). Re-assert the canonical schema.sql text so dumps
-- compare byte-equal.
CREATE OR REPLACE FUNCTION public.join_game_by_invite(invite_code_param TEXT)
RETURNS UUID AS $$
DECLARE
  v_uid     UUID := (SELECT auth.uid());
  v_game_id UUID;
  v_gm_id   UUID;
BEGIN
  -- Must be authenticated.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Resolve the game by its invite code (the secret), not by a guessable id.
  SELECT id, gm_id INTO v_game_id, v_gm_id
  FROM public.games
  WHERE invite_code = invite_code_param;

  IF v_game_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code' USING ERRCODE = 'P0002';
  END IF;

  -- The GM already owns the game; nothing to do (avoids a phantom membership row).
  IF v_gm_id = v_uid THEN
    RETURN v_game_id;
  END IF;

  -- Enforce the same player cap the old INSERT policy did (members + GM).
  IF public.count_game_players(v_game_id) >= 50 THEN
    RAISE EXCEPTION 'Game is full' USING ERRCODE = 'P0001';
  END IF;

  -- Always join as a regular player. Co-GM is granted later by the GM via UPDATE.
  INSERT INTO public.game_memberships (game_id, user_id, is_co_gm)
  VALUES (v_game_id, v_uid, FALSE)
  ON CONFLICT (game_id, user_id) DO NOTHING;

  RETURN v_game_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.shares_game_with(target_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_uid UUID := (SELECT auth.uid());
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM (
      SELECT game_id FROM public.game_memberships WHERE user_id = current_uid
      UNION ALL
      SELECT id FROM public.games WHERE gm_id = current_uid
    ) my_games
    JOIN (
      SELECT game_id FROM public.game_memberships WHERE user_id = target_user_id
      UNION ALL
      SELECT id FROM public.games WHERE gm_id = target_user_id
    ) their_games ON my_games.game_id = their_games.game_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';
