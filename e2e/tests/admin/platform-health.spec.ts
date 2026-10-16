import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { getAdminClient } from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

const SUPABASE_URL = 'http://localhost:54321';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

test.describe('Admin platform health trends', () => {
  test('overview renders the platform health charts', async ({ page, request }) => {
    const admin = await createTestUser(request, {
      email: `admin-health-${Date.now()}@e2e.local`,
      name: 'Admin Health User',
      is_gm: true,
      is_admin: true,
    });
    await loginTestUser(page, { email: admin.email, name: admin.name, is_gm: true, is_admin: true });

    await page.goto('/admin');

    await expect(page.getByRole('heading', { name: 'Platform Health', exact: true })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    for (const title of ['Healthy Games', 'Healthy Users', 'Healthy Share', 'Activation Funnel', 'Dormant Games', 'Deletions', 'Sessions Played']) {
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    }
    // Overview tiles: both healthy counts carry their share of the live base.
    await expect(page.getByText(/% of \d+ active users · \d+ churned/)).toBeVisible();
    await expect(page.getByText(/% of \d+ live games · \d+ dormant/)).toBeVisible();
  });

  test('health trends API is admin-only', async ({ page, request }) => {
    const user = await createTestUser(request, {
      email: `nonadmin-health-${Date.now()}@e2e.local`,
      name: 'Non Admin Health User',
      is_gm: true,
      is_admin: false,
    });
    await loginTestUser(page, { email: user.email, name: user.name, is_gm: true, is_admin: false });

    const res = await page.request.get('/api/admin/health-trends?weeks=8');
    expect(res.status()).toBe(403);
  });

  test('cron endpoint rejects requests without the cron secret', async ({ request }) => {
    const res = await request.get('/api/cron/platform-stats');
    expect(res.status()).toBe(401);
    const forged = await request.get('/api/cron/platform-stats', {
      headers: { Authorization: 'Bearer not-the-secret' },
    });
    expect(forged.status()).toBe(401);
  });

  test('cron records recent days only, and is idempotent', async ({ request }) => {
    // A user who signed up 30 days ago gives the platform 30 days of history.
    const user = await createTestUser(request, {
      email: `cron-history-${Date.now()}@e2e.local`,
      name: 'Cron History User',
      is_gm: true,
      is_admin: false,
    });
    const admin = getAdminClient();
    const { error: backdateError } = await admin
      .from('users')
      .update({ created_at: new Date(Date.now() - 30 * 86_400_000).toISOString() })
      .eq('id', user.id);
    expect(backdateError).toBeNull();

    // Start from an empty table so the run has days to write (rows persist across runs).
    const { error: clearError } = await admin.from('platform_daily_stats').delete().gte('day', '1970-01-01');
    expect(clearError).toBeNull();

    const auth = { headers: { Authorization: 'Bearer test-cron-secret-for-e2e' } };
    const first = await request.get('/api/cron/platform-stats', auth);
    expect(first.status()).toBe(200);
    const { written } = (await first.json()) as { written: string[] };

    // Gap-fill is capped to the last 7 days; older history is the backfill script's job.
    const yesterday = new Date(Date.now() - 86_400_000);
    const oldestAllowed = new Date(Date.now() - 7 * 86_400_000);
    const key = (d: Date) => d.toLocaleDateString('sv-SE'); // yyyy-MM-dd, local
    // 30 days of history, but only the last 7 are written.
    expect(written).toHaveLength(7);
    expect(written.every((day) => day >= key(oldestAllowed) && day <= key(yesterday))).toBe(true);

    const { data: rows } = await admin.from('platform_daily_stats').select('day, source').in('day', written);
    const sources = Object.fromEntries((rows ?? []).map((r) => [r.day, r.source]));
    expect(sources[key(yesterday)]).toBe('snapshot');

    const second = await request.get('/api/cron/platform-stats', auth);
    expect(((await second.json()) as { written: string[] }).written).toEqual([]);
  });

  test('stats and deletion log are not readable through the Data API', async () => {
    // Guarantee a row exists, so an empty result means RLS hid it, not an empty table.
    const { error: seedError } = await getAdminClient()
      .from('deletion_log')
      .insert({ entity: 'session', cascaded: false });
    expect(seedError).toBeNull();

    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    for (const table of ['platform_daily_stats', 'deletion_log'] as const) {
      const { data, error } = await anon.from(table).select('*').limit(1);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
  });
});
