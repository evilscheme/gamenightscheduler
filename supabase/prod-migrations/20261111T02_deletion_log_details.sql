-- Deletion records carry facts about what was deleted.
--
-- deletion_log has so far recorded only that a user, game, session or membership
-- was deleted, and when. This adds three nullable columns, filled by a rewritten
-- log_deletion():
--   actor    who did it, as a role: 'self', 'gm' or 'system'
--   xact     the transaction the delete ran in, tying a cascade to its cause
--   details  anonymous facts about the deleted row (age, player and session
--            counts, ...): counts, flags and day-precision dates only, never an
--            id, a name or anything a user wrote
--            (docs/adr/0001-deletion-records-stay-anonymous.md)
--
-- The four triggers move from AFTER DELETE to BEFORE DELETE. The facts are counts
-- of the row's children, and the foreign-key cascade that removes those children
-- runs ahead of an AFTER trigger, so AFTER would always count zero.
--
-- Behaviour change: a membership removed because its user has just become the
-- game's host (ownership transfer during account deletion) is no longer recorded.
-- It was being counted as a player leaving.
--
-- Existing rows keep NULL in all three columns; their facts cannot be recovered.
--
-- Pre-flight: none — the columns are additive and nullable. The function body
-- below is copied verbatim from schema.sql.

ALTER TABLE deletion_log
  ADD COLUMN IF NOT EXISTS actor TEXT CHECK (actor IN ('self', 'gm', 'system')),
  ADD COLUMN IF NOT EXISTS xact BIGINT,
  ADD COLUMN IF NOT EXISTS details JSONB;

CREATE OR REPLACE FUNCTION public.log_deletion()
RETURNS TRIGGER AS $$
DECLARE
  v_entity TEXT;
  v_cascaded BOOLEAN := FALSE;
  v_uid UUID := auth.uid();
  v_actor TEXT;
  v_today DATE;
  v_details JSONB;
BEGIN
  v_actor := CASE WHEN v_uid IS NULL THEN 'system' ELSE 'gm' END;

  CASE TG_TABLE_NAME
    WHEN 'users' THEN
      v_entity := 'user';
      v_actor := 'system';
      v_details := jsonb_build_object(
        'created', (COALESCE(OLD.created_at, now()) AT TIME ZONE 'UTC')::date,
        'games_hosted', (SELECT count(*) FROM public.games WHERE gm_id = OLD.id),
        'games_joined', (SELECT count(*) FROM public.game_memberships WHERE user_id = OLD.id),
        'availability_entries', (SELECT count(*) FROM public.availability WHERE user_id = OLD.id)
      );
    WHEN 'games' THEN
      v_entity := 'game';
      v_cascaded := NOT EXISTS (SELECT 1 FROM public.users WHERE id = OLD.gm_id);
      v_today := public.game_today(OLD.id);
      v_details := jsonb_build_object(
        'created', (COALESCE(OLD.created_at, now()) AT TIME ZONE 'UTC')::date,
        'players', 1 + (SELECT count(*) FROM public.game_memberships WHERE game_id = OLD.id),
        'sessions_past', (SELECT count(*) FROM public.sessions WHERE game_id = OLD.id AND date < v_today),
        'sessions_upcoming', (SELECT count(*) FROM public.sessions WHERE game_id = OLD.id AND date >= v_today),
        'availability_entries', (SELECT count(*) FROM public.availability WHERE game_id = OLD.id),
        'extra_dates', (SELECT count(*) FROM public.game_play_dates WHERE game_id = OLD.id),
        'last_activity', (GREATEST(
          COALESCE(OLD.created_at, now()),
          (SELECT max(joined_at) FROM public.game_memberships WHERE game_id = OLD.id),
          (SELECT max(created_at) FROM public.sessions WHERE game_id = OLD.id),
          (SELECT max(GREATEST(created_at, updated_at)) FROM public.availability WHERE game_id = OLD.id),
          (SELECT max(created_at) FROM public.game_play_dates WHERE game_id = OLD.id)
        ) AT TIME ZONE 'UTC')::date
      );
    WHEN 'sessions' THEN
      v_entity := 'session';
      v_cascaded := NOT EXISTS (SELECT 1 FROM public.games WHERE id = OLD.game_id);
      v_details := jsonb_build_object(
        'created', (COALESCE(OLD.created_at, now()) AT TIME ZONE 'UTC')::date,
        'session_date', OLD.date,
        'days_until', OLD.date - public.game_today(OLD.game_id)
      );
    WHEN 'game_memberships' THEN
      IF EXISTS (SELECT 1 FROM public.games WHERE id = OLD.game_id AND gm_id = OLD.user_id) THEN
        RETURN OLD;
      END IF;
      v_entity := 'membership';
      v_cascaded := NOT EXISTS (SELECT 1 FROM public.games WHERE id = OLD.game_id)
        OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = OLD.user_id);
      IF v_uid = OLD.user_id THEN
        v_actor := 'self';
      END IF;
      v_details := jsonb_build_object(
        'joined', (COALESCE(OLD.joined_at, now()) AT TIME ZONE 'UTC')::date,
        'co_gm', OLD.is_co_gm,
        'availability_entries', (
          SELECT count(*) FROM public.availability WHERE game_id = OLD.game_id AND user_id = OLD.user_id
        )
      );
  END CASE;

  INSERT INTO public.deletion_log (entity, cascaded, actor, xact, details)
  VALUES (v_entity, v_cascaded, v_actor, txid_current(), v_details);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS log_user_deletion ON users;
DROP TRIGGER IF EXISTS log_game_deletion ON games;
DROP TRIGGER IF EXISTS log_session_deletion ON sessions;
DROP TRIGGER IF EXISTS log_membership_deletion ON game_memberships;
CREATE TRIGGER log_user_deletion
  BEFORE DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION public.log_deletion();
CREATE TRIGGER log_game_deletion
  BEFORE DELETE ON games
  FOR EACH ROW EXECUTE FUNCTION public.log_deletion();
CREATE TRIGGER log_session_deletion
  BEFORE DELETE ON sessions
  FOR EACH ROW EXECUTE FUNCTION public.log_deletion();
CREATE TRIGGER log_membership_deletion
  BEFORE DELETE ON game_memberships
  FOR EACH ROW EXECUTE FUNCTION public.log_deletion();

-- CREATE OR REPLACE keeps the existing grants; restated so the file stands alone.
REVOKE EXECUTE ON FUNCTION public.log_deletion() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_deletion() FROM authenticated;
