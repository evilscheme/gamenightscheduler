import { NextRequest, NextResponse } from 'next/server';
import { startOfDay, subDays, format } from 'date-fns';
import { createTtlCache, requireAdmin, paginate } from '@/lib/api/admin';
import {
  buildDeletions,
  buildDormancy,
  buildFunnelCohorts,
  getBucketIndex,
  indexPlatform,
  parseWeeks,
  windowEnds,
} from '@/lib/admin';
import { fetchPlatformInputs, rowToCounts } from '@/lib/admin/platformStatsStore';
import { serverError } from '@/lib/apiError';
import type { AdminHealthTrends, HealthTrendPoint } from '@/types/api';

const cache = createTtlCache<AdminHealthTrends>(30 * 60 * 1000);

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;
    const { admin } = result;

    const weeks = parseWeeks(request.nextUrl.searchParams.get('weeks'));
    const cacheKey = String(weeks ?? 'all');
    const cached = cache.get(cacheKey);
    if (cached) return NextResponse.json(cached);

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

    const days = windowEnds(windows, endExclusive);
    const cutoff = format(subDays(endExclusive, windows * 7), 'yyyy-MM-dd');

    const [statsResult, deletionRows] = await Promise.all([
      admin.from('platform_daily_stats').select('*').in('day', days),
      paginate<{ entity: string; cascaded: boolean; deleted_at: string }>(
        admin,
        'deletion_log',
        'entity, cascaded, deleted_at',
        { dateColumn: 'deleted_at', cutoff }
      ),
    ]);
    if (statsResult.error) throw statsResult.error;
    const statsByDay = new Map((statsResult.data ?? []).map((r) => [r.day, r]));

    const health: HealthTrendPoint[] = days.map((windowEnd) => {
      const r = statsByDay.get(windowEnd);
      return r
        ? { windowEnd, source: r.source as HealthTrendPoint['source'], counts: rowToCounts(r) }
        : { windowEnd, source: null, counts: null };
    });

    const indexed = indexPlatform(inputs);
    const data: AdminHealthTrends = {
      health,
      funnel: buildFunnelCohorts(indexed, now, windows),
      dormancy: buildDormancy(indexed, now, windows),
      deletions: buildDeletions(deletionRows, now, windows),
    };
    cache.set(cacheKey, data);
    return NextResponse.json(data);
  } catch (error) {
    return serverError(error, { route: '/api/admin/health-trends' });
  }
}
