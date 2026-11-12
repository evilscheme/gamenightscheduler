import { test, expect, type APIRequestContext } from '@playwright/test';
import { execSync } from 'node:child_process';
import { createTestUser } from '../../helpers/test-auth';
import { createTestGame, addPlayerToGame, getAdminClient } from '../../helpers/seed';
import type { TestUser } from '../../helpers/seed';

const SUPABASE_URL = 'http://localhost:54321';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const admin = getAdminClient();

/**
 * Regression guard for the write bounds on availability / game_play_dates and
 * the timezone shape constraints (2026-11).
 *
 * Without the bounds, any signed-up user could create a game and bulk-insert
 * rows for every date from year 1 to 9999 through PostgREST. The RLS policies
 * now accept only `UTC date - 1 <= date <= game_window_end(game_id)`. Without
 * the timezone CHECKs, a GM could PATCH a zone that crashed every member's
 * dashboard, or one carrying CR/LF that injected lines into the iCal feed.
 *
 * Drives the real PostgREST surface as an *authenticated* user (the admin
 * client bypasses RLS and is used only for setup and read-back).
 */

// The policy bound is in UTC (the server's only clock), so the test computes
// its dates in UTC too — deliberately not the runner's local date.
function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
function windowEnd(gameId: string): string {
  return execSync(`psql "${DB_URL}" -tAc "SELECT public.game_window_end('${gameId}');"`, {
    encoding: 'utf8',
  }).trim();
}

async function tokenFor(request: APIRequestContext, user: TestUser): Promise<string> {
  const res = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    data: { email: user.email, password: 'test-password-123!' },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).access_token;
}

function rest(request: APIRequestContext, token: string) {
  const headers = (prefer = 'return=minimal') => ({
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: prefer,
  });
  return {
    post: (table: string, data: unknown, prefer?: string) =>
      request.post(`${SUPABASE_URL}/rest/v1/${table}`, { headers: headers(prefer), data }),
    patch: (pathAndQuery: string, data: unknown) =>
      request.patch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
        headers: headers('return=representation'),
        data,
      }),
  };
}

async function setup(request: APIRequestContext, label: string, gameOptions = {}) {
  const ts = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const gm = await createTestUser(request, {
    email: `bounds-gm-${label}-${ts}@e2e.local`,
    name: 'Bounds GM',
    is_gm: true,
  });
  const player = await createTestUser(request, {
    email: `bounds-player-${label}-${ts}@e2e.local`,
    name: 'Bounds Player',
    is_gm: false,
  });
  // Every weekday is a play day, so only the date bounds can reject a row.
  const game = await createTestGame({
    gm_id: gm.id,
    play_days: [0, 1, 2, 3, 4, 5, 6],
    ...gameOptions,
  });
  await addPlayerToGame(game.id, player.id);
  return {
    gm,
    player,
    game,
    gmApi: rest(request, await tokenFor(request, gm)),
    playerApi: rest(request, await tokenFor(request, player)),
  };
}

const availRow = (userId: string, gameId: string, date: string) => ({
  user_id: userId,
  game_id: gameId,
  date,
  status: 'available',
});

test.describe('availability write bounds (RLS)', () => {
  test('accepts today and UTC-yesterday; rejects two days ago and far past', async ({ request }) => {
    test.setTimeout(60000);
    const { player, game, playerApi } = await setup(request, 'past');
    const today = utcToday();

    expect((await playerApi.post('availability', availRow(player.id, game.id, today))).status()).toBe(201);
    // UTC-yesterday is still "today" for a viewer west of UTC.
    expect(
      (await playerApi.post('availability', availRow(player.id, game.id, addDays(today, -1)))).status()
    ).toBe(201);
    expect(
      (await playerApi.post('availability', availRow(player.id, game.id, addDays(today, -2)))).status()
    ).toBe(403);
    expect(
      (await playerApi.post('availability', availRow(player.id, game.id, '0001-01-01'))).status()
    ).toBe(403);
  });

  test('accepts the last day of the window; rejects past it and far future', async ({ request }) => {
    test.setTimeout(60000);
    const { player, game, playerApi } = await setup(request, 'future', {
      scheduling_window_months: 2,
    });
    const end = windowEnd(game.id);

    expect((await playerApi.post('availability', availRow(player.id, game.id, end))).status()).toBe(201);
    expect(
      (await playerApi.post('availability', availRow(player.id, game.id, addDays(end, 1)))).status()
    ).toBe(403);
    expect(
      (await playerApi.post('availability', availRow(player.id, game.id, addDays(end, 2)))).status()
    ).toBe(403);
    expect(
      (await playerApi.post('availability', availRow(player.id, game.id, '9999-12-31'))).status()
    ).toBe(403);
  });

  test('a campaign end date before the months-based end caps the window', async ({ request }) => {
    test.setTimeout(60000);
    const campaignEnd = addDays(utcToday(), 10);
    const { player, game, playerApi } = await setup(request, 'campaign', {
      scheduling_window_months: 12,
      campaign_end_date: campaignEnd,
    });
    expect(windowEnd(game.id)).toBe(campaignEnd);

    expect(
      (await playerApi.post('availability', availRow(player.id, game.id, campaignEnd))).status()
    ).toBe(201);
    expect(
      (await playerApi.post('availability', availRow(player.id, game.id, addDays(campaignEnd, 1)))).status()
    ).toBe(403);
  });

  test('an ad-hoc-only game uses the same months-based window', async ({ request }) => {
    test.setTimeout(60000);
    const { player, game, playerApi } = await setup(request, 'adhoc', {
      ad_hoc_only: true,
      scheduling_window_months: 1,
    });
    const end = windowEnd(game.id);
    expect(
      (await playerApi.post('availability', availRow(player.id, game.id, end))).status()
    ).toBe(201);
    expect(
      (await playerApi.post('availability', availRow(player.id, game.id, addDays(end, 2)))).status()
    ).toBe(403);
  });

  test('an in-range row cannot be moved out of range by UPDATE', async ({ request }) => {
    test.setTimeout(60000);
    const { player, game, playerApi } = await setup(request, 'move');
    const date = addDays(utcToday(), 3);
    expect((await playerApi.post('availability', availRow(player.id, game.id, date))).status()).toBe(201);

    const res = await playerApi.patch(
      `availability?user_id=eq.${player.id}&game_id=eq.${game.id}&date=eq.${date}`,
      { date: '9999-01-01' }
    );
    expect(res.status()).toBe(403);

    const { data } = await admin
      .from('availability')
      .select('date')
      .eq('user_id', player.id)
      .eq('game_id', game.id);
    expect(data?.map((r) => r.date)).toEqual([date]);
  });

  test('a batch upsert of existing in-range rows succeeds', async ({ request }) => {
    test.setTimeout(60000);
    const { player, game, playerApi } = await setup(request, 'upsert');
    const today = utcToday();
    const dates = [addDays(today, 1), addDays(today, 2), addDays(today, 3)];
    expect(
      (await playerApi.post('availability', dates.map((d) => availRow(player.id, game.id, d)))).status()
    ).toBe(201);

    // Same rows again with a new status, resolved as updates on the unique key.
    const res = await request.post(
      `${SUPABASE_URL}/rest/v1/availability?on_conflict=user_id,game_id,date`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${await tokenFor(request, player)}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        data: dates.map((d) => ({ ...availRow(player.id, game.id, d), status: 'maybe' })),
      }
    );
    // PostgREST answers 200, not 201, when every row resolved as an update.
    expect([200, 201]).toContain(res.status());

    const { data } = await admin
      .from('availability')
      .select('status')
      .eq('user_id', player.id)
      .eq('game_id', game.id);
    expect(data).toHaveLength(3);
    expect(data?.every((r) => r.status === 'maybe')).toBe(true);
  });
});

test.describe('game_play_dates write bounds (RLS)', () => {
  test('GM can add an in-window extra date but not one outside it', async ({ request }) => {
    test.setTimeout(60000);
    const { game, gmApi } = await setup(request, 'extra');
    const end = windowEnd(game.id);
    const row = (date: string) => ({ game_id: game.id, date, note: null });

    expect((await gmApi.post('game_play_dates', row(addDays(utcToday(), 5)))).status()).toBe(201);
    expect((await gmApi.post('game_play_dates', row(end))).status()).toBe(201);
    expect((await gmApi.post('game_play_dates', row(addDays(end, 2)))).status()).toBe(403);
    expect((await gmApi.post('game_play_dates', row(addDays(utcToday(), -2)))).status()).toBe(403);
  });

  test('an in-window extra date cannot be moved out of range by UPDATE', async ({ request }) => {
    test.setTimeout(60000);
    const { game, gmApi } = await setup(request, 'extramove');
    const date = addDays(utcToday(), 4);
    expect((await gmApi.post('game_play_dates', { game_id: game.id, date })).status()).toBe(201);
    const res = await gmApi.patch(`game_play_dates?game_id=eq.${game.id}&date=eq.${date}`, {
      date: '9999-01-01',
    });
    expect(res.status()).toBe(403);
    // Editing the note of an in-window date still works.
    const ok = await gmApi.patch(`game_play_dates?game_id=eq.${game.id}&date=eq.${date}`, {
      note: 'Bring snacks',
    });
    expect(ok.status()).toBe(200);
  });
});

test.describe('timezone shape constraints', () => {
  test('GM cannot store a garbage or CRLF-bearing game timezone', async ({ request }) => {
    test.setTimeout(60000);
    const { game, gmApi } = await setup(request, 'tz');
    for (const bad of ['UTC\r\nBEGIN:VALARM', 'America/New_York\n', 'Europe/London;X=1', 'a b']) {
      const res = await gmApi.patch(`games?id=eq.${game.id}`, { timezone: bad });
      expect(res.status(), `timezone ${JSON.stringify(bad)} must be rejected`).toBe(400);
    }
    for (const good of ['America/Argentina/Buenos_Aires', 'America/Port-au-Prince', 'Etc/GMT+5', 'UTC']) {
      const res = await gmApi.patch(`games?id=eq.${game.id}`, { timezone: good });
      expect(res.status(), `timezone ${good} must be accepted`).toBe(200);
    }
  });

  test('a user cannot store a CRLF-bearing timezone but can clear or set a valid one', async ({ request }) => {
    test.setTimeout(60000);
    const { player, playerApi } = await setup(request, 'usertz');
    const bad = await playerApi.patch(`users?id=eq.${player.id}`, { timezone: 'UTC\r\nX:1' });
    expect(bad.status()).toBe(400);
    expect((await playerApi.patch(`users?id=eq.${player.id}`, { timezone: 'Etc/GMT+5' })).status()).toBe(200);
    expect((await playerApi.patch(`users?id=eq.${player.id}`, { timezone: null })).status()).toBe(200);
  });
});
