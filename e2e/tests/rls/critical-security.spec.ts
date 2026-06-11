import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame, addPlayerToGame, getAdminClient } from '../../helpers/seed';

// Local Supabase credentials (same legacy demo anon key used by the other RLS specs)
const SUPABASE_URL = 'http://localhost:54321';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

/**
 * CRITICAL security regression tests (from the RLS audit).
 *
 * These two findings are the highest-severity holes in the membership model.
 * Both are exploited the same way: the browser talks to PostgREST directly with
 * the anon key, so RLS is the ONLY authorization layer on writes. The membership
 * INSERT policy (schema.sql "Users can join games") checks only
 *   auth.uid() = user_id  AND  count_game_players(game_id) < 50
 * and therefore:
 *
 *   A. Co-GM privilege escalation — nothing constrains `is_co_gm`, so a user can
 *      self-insert a membership with `is_co_gm: true` and instantly become a co-GM
 *      of any game whose id they know.
 *   B. Missing invite-code enforcement — the invite code is verified only in the
 *      /api/games/invite/[code] preview route (a display lookup); the actual write
 *      is a separate anon-key insert that never sees the code. Any authenticated
 *      user who learns a game's UUID (it appears in every /games/[id] URL) can join.
 *
 * STATUS: These assert the *desired secure* behavior, so they are expected to FAIL
 * (red) against the current schema — that failure IS the proof of the vulnerability.
 * They turn green once the membership INSERT path is hardened (constrain is_co_gm to
 * false; route joins through an invite-code-checking SECURITY DEFINER RPC and revoke
 * the direct INSERT).
 *
 * IMPORTANT — why `Prefer: return=minimal`:
 * The attack insert is performed with `return=minimal`, exactly as the app's own
 * `joinGame()` does (`supabase.from('game_memberships').insert({...})` with no
 * `.select()`). The shared `supabaseRestCall` helper used elsewhere sends
 * `return=representation`, which makes PostgREST run a post-insert visibility SELECT.
 * For a brand-new self-join row, that SELECT fails its own `is_game_participant`
 * policy (the row isn't visible to the SECURITY DEFINER lookup yet) and rolls the
 * insert back — which would mask this vulnerability behind a misleading 403. Minimal
 * return faithfully reproduces the real, successful join path.
 */

/**
 * Perform an authenticated INSERT via the anon-key REST API with
 * `Prefer: return=minimal` — the same request shape the shipped client bundle
 * issues for a join. Returns the HTTP status only (no body on minimal return).
 */
async function authedInsertMinimal(
  page: import('@playwright/test').Page,
  table: string,
  row: Record<string, unknown>
): Promise<number> {
  return page.evaluate(
    async ({ url, anonKey, table, row }) => {
      const cookies = document.cookie.split(';').map((c) => c.trim());
      const authCookies = cookies.filter((c) => c.includes('auth-token')).sort();
      let raw = '';
      for (const c of authCookies) raw += decodeURIComponent(c.split('=').slice(1).join('='));
      const tokenJson = raw.startsWith('base64-') ? atob(raw.slice('base64-'.length)) : raw;
      const parsed = JSON.parse(tokenJson);
      const accessToken = parsed.access_token || (Array.isArray(parsed) ? parsed[0] : '');
      if (!accessToken) throw new Error('No access token found in cookies');

      const response = await fetch(`${url}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(row),
      });
      return response.status;
    },
    { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, table, row }
  );
}

/**
 * Call a PostgREST RPC as the authenticated browser user. Returns status + body.
 */
async function authedRpc(
  page: import('@playwright/test').Page,
  fn: string,
  args: Record<string, unknown>
): Promise<{ status: number; data: unknown }> {
  return page.evaluate(
    async ({ url, anonKey, fn, args }) => {
      const cookies = document.cookie.split(';').map((c) => c.trim());
      const authCookies = cookies.filter((c) => c.includes('auth-token')).sort();
      let raw = '';
      for (const c of authCookies) raw += decodeURIComponent(c.split('=').slice(1).join('='));
      const tokenJson = raw.startsWith('base64-') ? atob(raw.slice('base64-'.length)) : raw;
      const parsed = JSON.parse(tokenJson);
      const accessToken = parsed.access_token || (Array.isArray(parsed) ? parsed[0] : '');
      if (!accessToken) throw new Error('No access token found in cookies');

      const response = await fetch(`${url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
      });
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      return { status: response.status, data };
    },
    { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, fn, args }
  );
}

test.describe('CRITICAL: co-GM privilege escalation on join', () => {
  test('a joining user cannot grant themselves co-GM via the membership insert', async ({
    page,
    request,
  }) => {
    const ts = Date.now();

    // Victim GM owns a game (set up via admin, bypassing RLS).
    const gm = await createTestUser(request, {
      email: `victim-gm-cogm-${ts}@e2e.local`,
      name: 'Victim GM',
      is_gm: true,
    });
    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Co-GM Escalation Target',
      play_days: [5, 6],
    });

    // Attacker: an ordinary authenticated user who is NOT a member.
    const attacker = await createTestUser(request, {
      email: `attacker-cogm-${ts}@e2e.local`,
      name: 'Co-GM Attacker',
      is_gm: true,
    });
    await loginTestUser(page, {
      email: attacker.email,
      name: attacker.name,
      is_gm: true,
    });

    // Self-insert a membership with is_co_gm: true, exactly as a crafted join would.
    await authedInsertMinimal(page, 'game_memberships', {
      game_id: game.id,
      user_id: attacker.id,
      is_co_gm: true,
    });

    // SECURITY INVARIANT (fix-agnostic): the attacker must never end up as a co-GM
    // of a game they don't own — whether the fix rejects the insert outright or
    // forces is_co_gm to false, the DB must not show them as co-GM.
    const admin = getAdminClient();
    const { data: rows } = await admin
      .from('game_memberships')
      .select('is_co_gm')
      .eq('game_id', game.id)
      .eq('user_id', attacker.id);

    const grantedCoGm = (rows ?? []).some((r) => r.is_co_gm === true);
    expect(grantedCoGm).toBe(false);
  });
});

test.describe('CRITICAL: missing invite-code enforcement on join', () => {
  test('an authenticated user cannot join a game by its id without the invite code', async ({
    page,
    request,
  }) => {
    const ts = Date.now();

    // Victim GM owns a game. The attacker only ever learns the game UUID
    // (e.g. leaked from a /games/[id] URL) — never the invite code.
    const gm = await createTestUser(request, {
      email: `victim-gm-join-${ts}@e2e.local`,
      name: 'Victim GM',
      is_gm: true,
    });
    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Private Game',
      play_days: [5, 6],
    });

    const attacker = await createTestUser(request, {
      email: `attacker-join-${ts}@e2e.local`,
      name: 'Uninvited Attacker',
      is_gm: true,
    });
    await loginTestUser(page, {
      email: attacker.email,
      name: attacker.name,
      is_gm: true,
    });

    // Direct self-insert keyed only by the known game_id — no invite code presented.
    await authedInsertMinimal(page, 'game_memberships', {
      game_id: game.id,
      user_id: attacker.id,
    });

    // SECURITY INVARIANT: knowing the game's UUID is not sufficient to join it.
    const admin = getAdminClient();
    const { data: rows } = await admin
      .from('game_memberships')
      .select('user_id')
      .eq('game_id', game.id)
      .eq('user_id', attacker.id);

    expect(rows ?? []).toHaveLength(0);
  });

  test('a removed player cannot silently rejoin via a direct membership insert', async ({
    page,
    request,
  }) => {
    const ts = Date.now();

    const gm = await createTestUser(request, {
      email: `gm-rejoin-${ts}@e2e.local`,
      name: 'Rejoin GM',
      is_gm: true,
    });
    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Rejoin Target Game',
      play_days: [5, 6],
    });

    // Player joins, then is removed by the GM (both via admin setup).
    const player = await createTestUser(request, {
      email: `removed-player-${ts}@e2e.local`,
      name: 'Removed Player',
      is_gm: false,
    });
    await addPlayerToGame(game.id, player.id);

    const admin = getAdminClient();
    await admin
      .from('game_memberships')
      .delete()
      .eq('game_id', game.id)
      .eq('user_id', player.id);

    // The removed player still knows the game_id and tries to re-insert directly.
    await loginTestUser(page, {
      email: player.email,
      name: player.name,
      is_gm: false,
    });

    await authedInsertMinimal(page, 'game_memberships', {
      game_id: game.id,
      user_id: player.id,
    });

    // SECURITY INVARIANT: a removed player must not regain membership through an
    // unmediated insert that bypasses the invite flow.
    const { data: rows } = await admin
      .from('game_memberships')
      .select('user_id')
      .eq('game_id', game.id)
      .eq('user_id', player.id);

    expect(rows ?? []).toHaveLength(0);
  });
});

test.describe('join_game_by_invite RPC (the sanctioned join path)', () => {
  test('a valid invite code joins the caller as a regular player, never co-GM', async ({
    page,
    request,
  }) => {
    const ts = Date.now();

    const gm = await createTestUser(request, {
      email: `gm-rpc-join-${ts}@e2e.local`,
      name: 'RPC Join GM',
      is_gm: true,
    });
    const game = await createTestGame({
      gm_id: gm.id,
      name: 'RPC Join Game',
      play_days: [5, 6],
    });

    const joiner = await createTestUser(request, {
      email: `joiner-rpc-${ts}@e2e.local`,
      name: 'Legit Joiner',
      is_gm: false,
    });
    await loginTestUser(page, {
      email: joiner.email,
      name: joiner.name,
      is_gm: false,
    });

    const res = await authedRpc(page, 'join_game_by_invite', {
      invite_code_param: game.invite_code,
    });
    expect(res.status).toBe(200);

    // The join succeeded and the player is a regular member (not co-GM).
    const admin = getAdminClient();
    const { data: rows } = await admin
      .from('game_memberships')
      .select('is_co_gm')
      .eq('game_id', game.id)
      .eq('user_id', joiner.id);

    expect(rows).toHaveLength(1);
    expect(rows![0].is_co_gm).toBe(false);
  });

  test('an invalid invite code joins nothing', async ({ page, request }) => {
    const ts = Date.now();

    const joiner = await createTestUser(request, {
      email: `joiner-bad-${ts}@e2e.local`,
      name: 'Bad Code Joiner',
      is_gm: false,
    });
    await loginTestUser(page, {
      email: joiner.email,
      name: joiner.name,
      is_gm: false,
    });

    const res = await authedRpc(page, 'join_game_by_invite', {
      invite_code_param: `nonexistent-code-${ts}`,
    });
    expect(res.status).toBeGreaterThanOrEqual(400);

    const admin = getAdminClient();
    const { data: rows } = await admin
      .from('game_memberships')
      .select('user_id')
      .eq('user_id', joiner.id);

    expect(rows ?? []).toHaveLength(0);
  });
});
