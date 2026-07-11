-- P6.2: timezone-correct session cutoffs (see remediation plan)
--
-- game_today(game_id) computes "today" in the game's own timezone (UTC
-- fallback for null/invalid values); the sessions INSERT policy and
-- count_future_sessions() use it instead of UTC CURRENT_DATE, so "tonight"
-- in a US timezone is no longer rejected as past after 00:00 UTC.
--
-- Pre-flight: none needed.

CREATE OR REPLACE FUNCTION public.game_today(game_id_param UUID)
RETURNS DATE AS $$
DECLARE
  tz TEXT;
BEGIN
  SELECT timezone INTO tz FROM public.games WHERE id = game_id_param;
  BEGIN
    RETURN (now() AT TIME ZONE COALESCE(tz, 'UTC'))::date;
  EXCEPTION WHEN OTHERS THEN
    -- Invalid IANA name stored on the game: fall back to UTC rather than
    -- making every session insert fail.
    RETURN (now() AT TIME ZONE 'UTC')::date;
  END;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- Grant discipline for new functions (see open-security-findings progress log)
REVOKE EXECUTE ON FUNCTION public.game_today(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.game_today(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.count_future_sessions(game_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  session_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO session_count
  FROM public.sessions
  WHERE game_id = game_id_param
    AND date >= public.game_today(game_id_param);
  RETURN session_count;
END;
-- VOLATILE (not STABLE): count-based limit guard
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP POLICY IF EXISTS "GMs and co-GMs can insert sessions" ON public.sessions;
CREATE POLICY "GMs and co-GMs can insert sessions" ON public.sessions
  FOR INSERT WITH CHECK (
    public.is_game_gm_or_co_gm(game_id, (select auth.uid()))
    AND date >= public.game_today(game_id)
    AND public.count_future_sessions(game_id) < 100
  );

