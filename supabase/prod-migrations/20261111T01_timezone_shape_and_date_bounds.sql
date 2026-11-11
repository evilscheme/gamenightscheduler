-- Two hardening changes, both mirrored in schema.sql:
--
-- 1. games.timezone / users.timezone get a conservative IANA-shape CHECK
--    (^[A-Za-z0-9_+/-]{1,64}$, NULL allowed). A GM could PATCH any string into
--    games.timezone through PostgREST: an unknown zone crashed the dashboard
--    for every member, and a CR/LF-bearing one injected lines into the public
--    iCalendar feed. Shape check only, not a pg_timezone_names lookup (the
--    Postgres and browser zone lists differ).
--
-- 2. availability and game_play_dates writes are bounded in RLS to the dates
--    the UI can offer: date >= UTC date - 1 and date <= game_window_end(game_id)
--    (new helper). The UPDATE policies gain an explicit WITH CHECK so a row
--    can't be moved out of range after insert. Existing rows are untouched
--    (policies don't re-validate stored data), so no pre-flight is needed for
--    them; past rows simply become read/delete-only for their owners.
--
-- Pre-flight: the DO block raises with counts if any stored timezone already
-- violates the shape, before the ALTERs would fail opaquely; the transaction
-- then rolls back.

DO $$
DECLARE
  bad_games INTEGER;
  bad_users INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_games
  FROM public.games
  WHERE timezone IS NOT NULL AND timezone !~ '^[A-Za-z0-9_+/-]{1,64}$';
  SELECT COUNT(*) INTO bad_users
  FROM public.users
  WHERE timezone IS NOT NULL AND timezone !~ '^[A-Za-z0-9_+/-]{1,64}$';
  IF bad_games > 0 OR bad_users > 0 THEN
    RAISE EXCEPTION 'pre-flight failed: % game(s) and % user(s) have a malformed timezone — inspect with: SELECT id, timezone FROM public.games WHERE timezone !~ ''^[A-Za-z0-9_+/-]{1,64}$''; SELECT id, timezone FROM public.users WHERE timezone !~ ''^[A-Za-z0-9_+/-]{1,64}$''; (fix them, e.g. SET timezone = NULL or a valid zone, then re-run)', bad_games, bad_users;
  END IF;
END;
$$;

ALTER TABLE public.games ADD CONSTRAINT games_timezone_shape
  CHECK (timezone IS NULL OR timezone ~ '^[A-Za-z0-9_+/-]{1,64}$');
ALTER TABLE public.users ADD CONSTRAINT users_timezone_shape
  CHECK (timezone IS NULL OR timezone ~ '^[A-Za-z0-9_+/-]{1,64}$');

-- Last date the UI can offer for a game; see the comment above it in schema.sql.
-- Body copied verbatim from schema.sql.
CREATE OR REPLACE FUNCTION public.game_window_end(game_id_param UUID)
RETURNS DATE AS $$
DECLARE
  v_months     INTEGER;
  v_start      DATE;
  v_end        DATE;
  v_months_end DATE;
BEGIN
  SELECT scheduling_window_months, campaign_start_date, campaign_end_date
    INTO v_months, v_start, v_end
    FROM public.games WHERE id = game_id_param;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  -- GREATEST/LEAST ignore NULLs: no campaign start/end means no clamp. A NULL
  -- window length (the column has a default but no NOT NULL) reads as the
  -- longest allowed, 12, so the backstop never undercuts the client.
  v_start := GREATEST((now() AT TIME ZONE 'UTC')::date + 1, v_start);
  v_months_end := (date_trunc('month', v_start + make_interval(months => COALESCE(v_months, 12)))
                   + interval '1 month' - interval '1 day')::date;
  RETURN LEAST(v_months_end, v_end);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- Grant lockdown: policy evaluation needs authenticated EXECUTE; anon must not
-- be able to call it as an RPC.
REVOKE EXECUTE ON FUNCTION public.game_window_end(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.game_window_end(UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users can insert own availability" ON public.availability;
CREATE POLICY "Users can insert own availability" ON public.availability
  FOR INSERT WITH CHECK (
    (select auth.uid()) = user_id
    AND public.is_game_participant(game_id, (select auth.uid()))
    AND date >= (now() AT TIME ZONE 'UTC')::date - 1
    AND date <= public.game_window_end(game_id)
  );

DROP POLICY IF EXISTS "Users can update own availability" ON public.availability;
CREATE POLICY "Users can update own availability" ON public.availability
  FOR UPDATE USING (
    (select auth.uid()) = user_id
    AND public.is_game_participant(game_id, (select auth.uid()))
  )
  WITH CHECK (
    (select auth.uid()) = user_id
    AND public.is_game_participant(game_id, (select auth.uid()))
    AND date >= (now() AT TIME ZONE 'UTC')::date - 1
    AND date <= public.game_window_end(game_id)
  );

DROP POLICY IF EXISTS "GMs and co-GMs can insert play dates" ON public.game_play_dates;
CREATE POLICY "GMs and co-GMs can insert play dates" ON public.game_play_dates
  FOR INSERT WITH CHECK (
    public.is_game_gm_or_co_gm(game_id, (select auth.uid()))
    AND date >= (now() AT TIME ZONE 'UTC')::date - 1
    AND date <= public.game_window_end(game_id)
  );

DROP POLICY IF EXISTS "GMs and co-GMs can update play dates" ON public.game_play_dates;
CREATE POLICY "GMs and co-GMs can update play dates" ON public.game_play_dates
  FOR UPDATE USING (public.is_game_gm_or_co_gm(game_id, (select auth.uid())))
  WITH CHECK (
    public.is_game_gm_or_co_gm(game_id, (select auth.uid()))
    AND date >= (now() AT TIME ZONE 'UTC')::date - 1
    AND date <= public.game_window_end(game_id)
  );
