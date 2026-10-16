import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { CRON_GAP_FILL_DAYS, fillMissingDailyStats } from '@/lib/admin/platformStatsStore';
import { serverError } from '@/lib/apiError';

/**
 * Daily Vercel Cron (vercel.json): record yesterday's platform-health snapshot,
 * plus any of the last CRON_GAP_FILL_DAYS a failed run left empty. Full history
 * is scripts/backfill-platform-stats.ts, run by hand.
 * Vercel sends `Authorization: Bearer $CRON_SECRET`; anything else is rejected,
 * including every request when the secret isn't configured.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { written } = await fillMissingDailyStats(createAdminClient(), new Date(), {
      maxDays: CRON_GAP_FILL_DAYS,
    });
    return NextResponse.json({ written });
  } catch (error) {
    return serverError(error, { route: '/api/cron/platform-stats' });
  }
}
