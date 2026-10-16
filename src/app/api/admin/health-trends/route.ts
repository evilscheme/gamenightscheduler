import { NextRequest, NextResponse } from 'next/server';
import { startOfDay, subDays, format } from 'date-fns';
import { requireAdmin, paginate } from '@/lib/api/admin';
import {
  buildDeletions,
  buildDormancy,
  buildFunnelCohorts,
  getBucketIndex,
  indexPlatform,
  windowEndKey,
} from '@/lib/admin';
import { fetchPlatformInputs } from '@/lib/admin/platformStatsStore';
import { serverError } from '@/lib/apiError';
import type { AdminHealthTrends, HealthTrendPoint } from '@/types/api';

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const VALID_WEEKS = [8, 12, 26] as const;

// Best-effort per-instance cache, same as /api/admin/engagement.
const cache = new Map<string, { data: AdminHealthTrends; timestamp: number }>();

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;
    const { admin } = result;

    const weeksParam = request.nextUrl.searchParams.get('weeks');
    const weeks = weeksParam === 'all'
      ? null
      : VALID_WEEKS.includes(Number(weeksParam) as typeof VALID_WEEKS[number])
        ? Number(weeksParam)
        : 12;

    const cacheKey = String(weeks ?? 'all');
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    const now = new Date();
    const endExclusive = startOfDay(now);

    // Funnel and dormancy need all-time rows regardless of range (a cohort's
    // later joins, a game's earlier activity), so there's no cutoff here.
    // Read-only: daily stats are written by the cron and the backfill script,
    // and a day with no row is returned as a gap.
    const inputs = await fetchPlatformInputs(admin);

    // "All time" spans back to the window holding the first signup, so every
    // series shares one x-axis.
    let windows = weeks;
    if (windows === null) {
      const first = inputs.users.reduce<string | null>(
        (min, u) => (min === null || u.created_at < min ? u.created_at : min),
        null
      );
      const index = first ? getBucketIndex(first, endExclusive) : null;
      windows = index === null ? 1 : index + 1;
    }

    const windowEnds = Array.from({ length: windows }, (_, i) => windowEndKey(windows - 1 - i, endExclusive));
    const cutoff = format(subDays(endExclusive, windows * 7), 'yyyy-MM-dd');

    const [statsResult, deletionRows] = await Promise.all([
      admin.from('platform_daily_stats').select('*').in('day', windowEnds),
      paginate<{ entity: string; cascaded: boolean; deleted_at: string }>(
        admin,
        'deletion_log',
        'entity, cascaded, deleted_at',
        { dateColumn: 'deleted_at', cutoff }
      ),
    ]);
    if (statsResult.error) throw statsResult.error;
    const statsByDay = new Map((statsResult.data ?? []).map((r) => [r.day, r]));

    const health: HealthTrendPoint[] = windowEnds.map((windowEnd) => {
      const r = statsByDay.get(windowEnd);
      if (!r) {
        return {
          windowEnd,
          source: null,
          totalUsers: null,
          healthyBookedUsers: null,
          healthyViableUsers: null,
          gettingGoingUsers: null,
          unhealthyUsers: null,
          totalGames: null,
          healthyBookedGames: null,
          healthyViableGames: null,
          gettingGoingGames: null,
          unhealthyGames: null,
        };
      }
      return {
        windowEnd,
        source: r.source as HealthTrendPoint['source'],
        totalUsers: r.total_users,
        healthyBookedUsers: r.healthy_booked_users,
        healthyViableUsers: r.healthy_viable_users,
        gettingGoingUsers: r.getting_going_users,
        unhealthyUsers: r.unhealthy_users,
        totalGames: r.total_games,
        healthyBookedGames: r.healthy_booked_games,
        healthyViableGames: r.healthy_viable_games,
        gettingGoingGames: r.getting_going_games,
        unhealthyGames: r.unhealthy_games,
      };
    });

    const data: AdminHealthTrends = {
      health,
      funnel: buildFunnelCohorts(inputs, now, windows),
      dormancy: buildDormancy(indexPlatform(inputs), now, windows),
      deletions: buildDeletions(deletionRows, now, windows),
    };
    cache.set(cacheKey, { data, timestamp: Date.now() });
    return NextResponse.json(data);
  } catch (error) {
    return serverError(error, { route: '/api/admin/health-trends' });
  }
}
