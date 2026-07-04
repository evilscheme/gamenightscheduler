import { test, expect } from '@playwright/test';
import { createTestUser } from '../../helpers/test-auth';
import { getAdminClient } from '../../helpers/seed';
import { USAGE_LIMITS } from '../../../src/lib/constants';

const SUPABASE_URL = 'http://localhost:54321';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const admin = getAdminClient();

/**
 * Regression guard for the STABLE-count cap-bypass (found in review, 2026-07).
 *
 * The per-user game cap and per-game session cap are enforced only by count_*
 * helper functions in RLS INSERT ... WITH CHECK clauses. If those helpers are
 * STABLE, a single multi-row INSERT — which an authenticated user can send
 * directly to PostgREST as an array body, bypassing the app entirely —
 * evaluates the count ONCE against the statement-start snapshot, so every row
 * sees the same pre-insert count and the cap is bypassed. The helpers must be
 * VOLATILE so the cap is re-checked as rows accumulate within the statement.
 *
 * This test drives the real PostgREST surface as an *authenticated* user (NOT
 * the admin/service-role client, which bypasses RLS) — the actual attack path.
 */
test('games cap holds against a bulk array-insert by an authenticated user', async ({ request }) => {
  test.setTimeout(60000);
  const cap = USAGE_LIMITS.MAX_GAMES_PER_USER; // 20

  const gm = await createTestUser(request, {
    email: `bulk-cap-${Date.now()}@e2e.local`,
    name: 'Bulk Cap GM',
    is_gm: true,
  });

  // Seed to one below the cap via the admin client (bypasses RLS — fast setup).
  const seed = Array.from({ length: cap - 1 }, (_, i) => ({
    name: `Seed ${i}`,
    gm_id: gm.id,
    invite_code: `bulkcap-${Date.now()}-${i}`,
    play_days: [5],
  }));
  const { error: seedErr } = await admin.from('games').insert(seed);
  expect(seedErr).toBeNull();

  // Get a real access token for the user (test-auth creates them with this password).
  const tokenRes = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    data: { email: gm.email, password: 'test-password-123!' },
  });
  expect(tokenRes.ok()).toBeTruthy();
  const { access_token } = await tokenRes.json();

  // As the authenticated user, attempt to insert 5 games in ONE request — a
  // single multi-row INSERT. With 19 games already present and the cap at 20,
  // at most one row could be admitted; a STABLE count would let all 5 through.
  const bulk = Array.from({ length: 5 }, (_, i) => ({
    name: `Bulk ${i}`,
    gm_id: gm.id,
    invite_code: `bulkins-${Date.now()}-${i}`,
    play_days: [5],
  }));
  const insertRes = await request.post(`${SUPABASE_URL}/rest/v1/games`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    data: bulk,
  });

  // The security invariant: the user's game count must never exceed the cap,
  // whatever the HTTP status. (VOLATILE → the statement is rejected atomically
  // and the count stays 19; STABLE → all 5 land and the count becomes 24.)
  const { count } = await admin
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('gm_id', gm.id);
  expect(count ?? 0).toBeLessThanOrEqual(cap);

  // And PostgREST must have rejected the over-cap statement outright.
  const body = await insertRes.text();
  expect(insertRes.status(), body).toBeGreaterThanOrEqual(400);
});
