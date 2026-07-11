-- P6.3: backstop CHECK on games.play_days (weekdays 0-6 only; the UI can only
-- produce these — this guards future code paths and manual edits).
--
-- Pre-flight is built in: the DO block raises with the offending rows before
-- the ALTER would fail opaquely, and the transaction rolls back.

DO $$
DECLARE
  bad_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM public.games
  WHERE NOT (play_days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]);
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'pre-flight failed: % game(s) have out-of-range play_days — inspect with: SELECT id, name, play_days FROM public.games WHERE NOT (play_days <@ ARRAY[0,1,2,3,4,5,6]);', bad_count;
  END IF;
END;
$$;

ALTER TABLE public.games ADD CONSTRAINT games_play_days_check
  CHECK (play_days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]);

