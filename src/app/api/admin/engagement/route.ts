import { NextRequest, NextResponse } from 'next/server';
import { createTtlCache, requireAdmin } from '@/lib/api/admin';
import { buildRollingEngagement, engagementInputsFrom, parseWeeks } from '@/lib/admin';
import { getCachedPlatformInputs } from '@/lib/admin/platformStatsStore';
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
    // The same shared read the games list and health charts use, which the
    // Overview tab fires alongside this, so no table is scanned twice. Rolling
    // windows are anchored on midnight today (today is excluded as incomplete);
    // N "weeks" = N trailing 7-day windows.
    const inputs = engagementInputsFrom(await getCachedPlatformInputs(admin), now, weeks);

    // Bucket into rolling 7-day windows. Today is excluded as incomplete, so the
    // charts never plot partial data yet fresh data appears within a day. Empty
    // windows are zero-filled for a continuous line — see buildRollingEngagement.
    const weeklyData = buildRollingEngagement(inputs, now, weeks ?? undefined);

    const responseData = { weeklyData };
    cache.set(cacheKey, responseData);

    return NextResponse.json(responseData);
  } catch (error) {
    return serverError(error, { route: '/api/admin/engagement' });
  }
}
