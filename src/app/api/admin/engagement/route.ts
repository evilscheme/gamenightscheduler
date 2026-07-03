import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, paginate } from '@/lib/api/admin';
import { buildRollingEngagement } from '@/lib/adminEngagement';
import { startOfDay, subDays, format } from 'date-fns';
import { serverError } from '@/lib/apiError';

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const VALID_WEEKS = [8, 12, 26] as const;

// Best-effort in-memory cache keyed by weeks param.
// In serverless, this only helps when the function instance is reused across
// requests (Fluid Compute). Misses silently on cold starts — that's fine.
const cache = new Map<string, { data: unknown; timestamp: number }>();

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;
    const { admin } = result;

    // Parse weeks param
    const weeksParam = request.nextUrl.searchParams.get('weeks');
    const weeks = weeksParam === 'all'
      ? null
      : VALID_WEEKS.includes(Number(weeksParam) as typeof VALID_WEEKS[number])
        ? Number(weeksParam)
        : 12;

    // Check cache
    const cacheKey = String(weeks ?? 'all');
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    const now = new Date();
    // Rolling windows are anchored on midnight today (today is excluded as
    // incomplete). N "weeks" = N trailing 7-day windows, so fetch N*7 days back.
    const endExclusive = startOfDay(now);
    const cutoffDate = weeks
      ? format(subDays(endExclusive, weeks * 7), 'yyyy-MM-dd')
      : null;

    const cutoff = cutoffDate ?? undefined;
    const [users, games, sessions, availability] = await Promise.all([
      paginate<{ created_at: string }>(admin, 'users', 'created_at', { dateColumn: 'created_at', cutoff }),
      paginate<{ created_at: string }>(admin, 'games', 'created_at', { dateColumn: 'created_at', cutoff }),
      paginate<{ created_at: string; status: string }>(admin, 'sessions', 'created_at, status', { dateColumn: 'created_at', cutoff }),
      paginate<{ user_id: string; updated_at: string }>(admin, 'availability', 'user_id, updated_at', { dateColumn: 'updated_at', cutoff }),
    ]);

    // Bucket into rolling 7-day windows. Today is excluded as incomplete, so the
    // charts never plot partial data yet fresh data appears within a day. Empty
    // windows are zero-filled for a continuous line — see buildRollingEngagement.
    const weeklyData = buildRollingEngagement(
      { users, games, sessions, availability },
      now,
      weeks ?? undefined
    );

    const responseData = { weeklyData };
    cache.set(cacheKey, { data: responseData, timestamp: Date.now() });

    return NextResponse.json(responseData);
  } catch (error) {
    return serverError(error, { route: '/api/admin/engagement' });
  }
}
