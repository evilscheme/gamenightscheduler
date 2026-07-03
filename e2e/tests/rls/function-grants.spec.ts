import { test, expect } from '@playwright/test';

const SUPABASE_URL = 'http://localhost:54321';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

/**
 * The blanket `GRANT EXECUTE ON ALL FUNCTIONS ... TO anon` used to re-expose
 * the SECURITY DEFINER "oracle" helpers (and join_game_by_invite) to
 * unauthenticated callers via PostgREST RPC. anon must NOT be able to call them.
 */
test.describe('Function EXECUTE grants — anon lockdown', () => {
  const ANON_HEADERS = { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };

  for (const fn of ['count_game_players', 'count_future_sessions']) {
    test(`anon cannot RPC ${fn}`, async ({ request }) => {
      const res = await request.post(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
        headers: ANON_HEADERS,
        data: { game_id_param: '00000000-0000-0000-0000-000000000000' },
      });
      // PostgREST returns 404 (not in exposed schema for this role) or 403.
      expect(res.status()).toBeGreaterThanOrEqual(400);
    });
  }

  test('anon cannot RPC join_game_by_invite', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/rest/v1/rpc/join_game_by_invite`, {
      headers: ANON_HEADERS,
      data: { invite_code_param: 'AAAAAAAAAA' },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});
