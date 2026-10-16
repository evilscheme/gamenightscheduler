-- Admin platform-health history: platform_daily_stats + deletion_log.
--
-- platform_daily_stats holds one row per UTC day: how many users and games were in
-- each health bucket at the end of it (HealthBucket in src/lib/admin/platformHealth.ts).
-- Rows are written by the app (src/lib/admin/platformStatsStore.ts) — a daily Vercel
-- cron plus a one-off history backfill (npm run db:backfill-stats) — never by SQL.
-- Dormant games and churned users aren't stored: total minus the tracked buckets.
--
-- deletion_log is filled by AFTER DELETE triggers on users, games, sessions and
-- game_memberships. Deletions before this migration cannot be recovered; the
-- chart starts the day this is applied.
--
-- Both tables are admin-only: RLS enabled with no policies, read and written by
-- the service-role client. log_deletion() is trigger-only, so authenticated's
-- EXECUTE (from the default privileges) is revoked, same as handle_new_user().
--
-- Pre-flight: none — purely additive.

CREATE TABLE platform_daily_stats (
  day DATE PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('snapshot', 'reconstructed')),
  total_users INTEGER NOT NULL,
  healthy_booked_users INTEGER NOT NULL,
  healthy_viable_users INTEGER NOT NULL,
  getting_going_users INTEGER NOT NULL,
  unhealthy_users INTEGER NOT NULL,
  total_games INTEGER NOT NULL,
  healthy_booked_games INTEGER NOT NULL,
  healthy_viable_games INTEGER NOT NULL,
  getting_going_games INTEGER NOT NULL,
  unhealthy_games INTEGER NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE deletion_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity TEXT NOT NULL CHECK (entity IN ('user', 'game', 'session', 'membership')),
  cascaded BOOLEAN NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deletion_log_deleted_at ON deletion_log(deleted_at);

CREATE OR REPLACE FUNCTION public.log_deletion()
RETURNS TRIGGER AS $$
DECLARE
  v_entity TEXT;
  v_cascaded BOOLEAN := FALSE;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'users' THEN
      v_entity := 'user';
    WHEN 'games' THEN
      v_entity := 'game';
      v_cascaded := NOT EXISTS (SELECT 1 FROM public.users WHERE id = OLD.gm_id);
    WHEN 'sessions' THEN
      v_entity := 'session';
      v_cascaded := NOT EXISTS (SELECT 1 FROM public.games WHERE id = OLD.game_id);
    WHEN 'game_memberships' THEN
      v_entity := 'membership';
      v_cascaded := NOT EXISTS (SELECT 1 FROM public.games WHERE id = OLD.game_id)
        OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = OLD.user_id);
  END CASE;

  INSERT INTO public.deletion_log (entity, cascaded) VALUES (v_entity, v_cascaded);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS log_user_deletion ON users;
DROP TRIGGER IF EXISTS log_game_deletion ON games;
DROP TRIGGER IF EXISTS log_session_deletion ON sessions;
DROP TRIGGER IF EXISTS log_membership_deletion ON game_memberships;
CREATE TRIGGER log_user_deletion
  AFTER DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION public.log_deletion();
CREATE TRIGGER log_game_deletion
  AFTER DELETE ON games
  FOR EACH ROW EXECUTE FUNCTION public.log_deletion();
CREATE TRIGGER log_session_deletion
  AFTER DELETE ON sessions
  FOR EACH ROW EXECUTE FUNCTION public.log_deletion();
CREATE TRIGGER log_membership_deletion
  AFTER DELETE ON game_memberships
  FOR EACH ROW EXECUTE FUNCTION public.log_deletion();

ALTER TABLE platform_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE deletion_log ENABLE ROW LEVEL SECURITY;

-- Parity with schema.sql's blanket Data API grants (RLS still denies anon/authenticated).
GRANT ALL ON TABLE platform_daily_stats, deletion_log TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE deletion_log_id_seq TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.log_deletion() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_deletion() FROM authenticated;
