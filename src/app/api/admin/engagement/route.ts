import { NextRequest, NextResponse } from 'next/server';
import { createTtlCache, requireAdmin, paginate } from '@/lib/api/admin';
import { buildRollingEngagement, parseWeeks } from '@/lib/admin';
import { startOfDay, subDays, format } from 'date-fns';
import { serverError } from '@/lib/apiError';

const cache = createTtlCache<{ weeklyData: ReturnType<typeof buildRollingEngagement> }>(30 * 60 * 1000);

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
      // No cutoff: "sessions played" buckets by play date, and a session booked
      // before the range can be played inside it. Older rows just fall outside
      // the emitted windows.
      paginate<{ created_at: string; date: string; status: string }>(admin, 'sessions', 'created_at, date, status'),
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
    cache.set(cacheKey, responseData);

    return NextResponse.json(responseData);
  } catch (error) {
    return serverError(error, { route: '/api/admin/engagement' });
  }
}
