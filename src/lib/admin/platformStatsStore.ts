import { eachDayOfInterval, format, startOfDay, subDays } from 'date-fns';
import { paginate, type AdminClient } from '@/lib/api/admin';
import { computeDailyStats, indexPlatform, type PlatformInputs } from './platformHealth';

/** Fetch every row the platform-health metrics read. Admin (service-role) only. */
export async function fetchPlatformInputs(admin: AdminClient): Promise<PlatformInputs> {
  const [users, games, memberships, sessions, availability, playDates] = await Promise.all([
    paginate<PlatformInputs['users'][number]>(admin, 'users', 'id, created_at'),
    paginate<PlatformInputs['games'][number]>(
      admin,
      'games',
      'id, gm_id, created_at, play_days, scheduling_window_months, campaign_start_date, campaign_end_date, min_players_needed'
    ),
    paginate<PlatformInputs['memberships'][number]>(admin, 'game_memberships', 'game_id, user_id, joined_at'),
    paginate<PlatformInputs['sessions'][number]>(admin, 'sessions', 'game_id, date, created_at'),
    paginate<PlatformInputs['availability'][number]>(
      admin,
      'availability',
      'game_id, user_id, date, status, created_at, updated_at'
    ),
    paginate<PlatformInputs['playDates'][number]>(admin, 'game_play_dates', 'game_id, date, created_at'),
  ]);
  return { users, games, memberships, sessions, availability, playDates };
}

/** How far back the daily cron looks for days a failed run left empty. Anything
 *  older is history, which is the backfill script's job, not the cron's. */
export const CRON_GAP_FILL_DAYS = 7;

export interface FillResult {
  /** Days written, oldest first. */
  written: string[];
  /** Days in range that already had a row. */
  skipped: number;
}

/**
 * Write a platform_daily_stats row for each day in range that doesn't have one.
 * Today is never written — it isn't over.
 *
 * Range: the last `maxDays` days through yesterday, or (no `maxDays`) every day
 * since the first signup. Two callers, both deliberate writers:
 *   - the daily cron, with CRON_GAP_FILL_DAYS — yesterday plus any missed runs;
 *   - scripts/backfill-platform-stats.ts, unbounded — the one-off history rebuild.
 * Admin reads never call this; they show whatever rows exist.
 *
 * Yesterday is recorded as a 'snapshot': it's computed within a day of the
 * moment it describes, so almost nothing has been deleted since. Every older day
 * is 'reconstructed' from row timestamps.
 *
 * Idempotent and safe to race: inserts ignore existing days, so re-running (or a
 * cron run overlapping the script) never overwrites a row.
 */
export async function fillMissingDailyStats(
  admin: AdminClient,
  now: Date,
  opts: { maxDays?: number } = {}
): Promise<FillResult> {
  const yesterday = subDays(startOfDay(now), 1);
  const yesterdayKey = format(yesterday, 'yyyy-MM-dd');
  const earliest = opts.maxDays != null ? subDays(yesterday, opts.maxDays - 1) : null;

  const existing = await paginate<{ day: string }>(admin, 'platform_daily_stats', 'day', {
    dateColumn: 'day',
    cutoff: earliest ? format(earliest, 'yyyy-MM-dd') : undefined,
  });
  const have = new Set(existing.map((r) => r.day));

  // Cheap exit before fetching every table: a bounded range that's already full.
  if (earliest && eachDayOfInterval({ start: earliest, end: yesterday }).every((d) => have.has(format(d, 'yyyy-MM-dd')))) {
    return { written: [], skipped: have.size };
  }

  const data = await fetchPlatformInputs(admin);
  if (data.users.length === 0) return { written: [], skipped: 0 };

  const firstSignup = startOfDay(
    new Date(data.users.reduce((min, u) => (u.created_at < min ? u.created_at : min), data.users[0].created_at))
  );
  const start = earliest && earliest > firstSignup ? earliest : firstSignup;
  if (start > yesterday) return { written: [], skipped: 0 };

  const days = eachDayOfInterval({ start, end: yesterday }).map((d) => format(d, 'yyyy-MM-dd'));
  const missing = days.filter((day) => !have.has(day));
  if (missing.length === 0) return { written: [], skipped: days.length };

  const indexed = indexPlatform(data);
  const rows = missing.map((day) => {
    const s = computeDailyStats(indexed, day);
    return {
      day,
      source: day === yesterdayKey ? 'snapshot' : 'reconstructed',
      total_users: s.totalUsers,
      healthy_booked_users: s.healthyBookedUsers,
      healthy_viable_users: s.healthyViableUsers,
      getting_going_users: s.gettingGoingUsers,
      unhealthy_users: s.unhealthyUsers,
      total_games: s.totalGames,
      healthy_booked_games: s.healthyBookedGames,
      healthy_viable_games: s.healthyViableGames,
      getting_going_games: s.gettingGoingGames,
      unhealthy_games: s.unhealthyGames,
    };
  });

  // Chunked to stay well under PostgREST's request size limit on a long backfill.
  for (let i = 0; i < rows.length; i += 500) {
    const { error: insertError } = await admin
      .from('platform_daily_stats')
      .upsert(rows.slice(i, i + 500), { onConflict: 'day', ignoreDuplicates: true });
    if (insertError) throw insertError;
  }
  return { written: missing, skipped: days.length - missing.length };
}
