import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import {
  createTestGame,
  addPlayerToGame,
  setAvailability,
  getPlayDates,
  getAdminClient,
} from '../../helpers/seed';

// Local Supabase credentials
const SUPABASE_URL = 'http://localhost:54321';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

/**
 * Helper to make an authenticated Supabase REST API call from the browser.
 * Extracts the access token from cookies and sends the request.
 */
async function supabaseRestCall(
  page: import('@playwright/test').Page,
  options: {
    path: string;
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: Record<string, unknown>;
  }
): Promise<{ status: number; data: unknown }> {
  return page.evaluate(
    async ({ url, anonKey, path, method, body }) => {
      // Extract access token from Supabase auth cookies
      const cookies = document.cookie.split(';').map((c) => c.trim());
      const authCookies = cookies.filter((c) => c.includes('auth-token')).sort();
      let rawValue = '';
      for (const c of authCookies) {
        const val = c.split('=').slice(1).join('=');
        rawValue += decodeURIComponent(val);
      }
      const tokenJson = rawValue.startsWith('base64-')
        ? atob(rawValue.slice('base64-'.length))
        : rawValue;
      const parsed = JSON.parse(tokenJson);
      const accessToken = parsed.access_token || (Array.isArray(parsed) ? parsed[0] : '');

      if (!accessToken) throw new Error('No access token found in cookies');

      const headers: Record<string, string> = {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'return=representation',
      };
      if (body) headers['Content-Type'] = 'application/json';

      const response = await fetch(`${url}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      return { status: response.status, data };
    },
    {
      url: SUPABASE_URL,
      anonKey: SUPABASE_ANON_KEY,
      path: options.path,
      method: options.method,
      body: options.body ?? null,
    }
  );
}

/**
 * RLS Hardening Tests
 *
 * Tests for security fixes identified in the RLS audit:
 * #10 (High): Privilege escalation via is_admin
 * #1 (Medium): Explicit deny on users INSERT/DELETE
 * #2 (Medium): Availability INSERT requires game membership
 * #3 (Medium): Availability UPDATE requires game membership
 * #11 (Medium): game_memberships UPDATE WITH CHECK
 */

test.describe('User Column Protection (protect_user_columns trigger)', () => {
  test('user cannot set is_admin=true on themselves via REST API', async ({ page, request }) => {
    const ts = Date.now();
    const user = await createTestUser(request, {
      email: `escalation-test-${ts}@e2e.local`,
      name: 'Escalation Tester',
      is_gm: true,
    });

    await loginTestUser(page, {
      email: user.email,
      name: user.name,
      is_gm: true,
    });

    // Attempt to set is_admin=true via direct REST API call
    const result = await supabaseRestCall(page, {
      path: `/rest/v1/users?id=eq.${user.id}`,
      method: 'PATCH',
      body: { is_admin: true },
    });

    // The PATCH should succeed (200) but the trigger should reset is_admin to false
    expect(result.status).toBe(200);
    expect(Array.isArray(result.data)).toBe(true);
    const rows = result.data as { is_admin: boolean }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].is_admin).toBe(false);

    // Double-check via admin client that is_admin is still false
    const admin = getAdminClient();
    const { data: dbUser } = await admin
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    expect(dbUser?.is_admin).toBe(false);
  });

  test('user cannot change is_gm on themselves via REST API', async ({ page, request }) => {
    const ts = Date.now();
    const user = await createTestUser(request, {
      email: `gm-flag-test-${ts}@e2e.local`,
      name: 'GM Flag Tester',
      is_gm: true,
    });

    await loginTestUser(page, {
      email: user.email,
      name: user.name,
      is_gm: true,
    });

    const result = await supabaseRestCall(page, {
      path: `/rest/v1/users?id=eq.${user.id}`,
      method: 'PATCH',
      body: { is_gm: false },
    });

    expect(result.status).toBe(200);
    const rows = result.data as { is_gm: boolean }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].is_gm).toBe(true);
  });

  test('user cannot change email on themselves via REST API', async ({ page, request }) => {
    const ts = Date.now();
    const originalEmail = `email-lock-${ts}@e2e.local`;
    const user = await createTestUser(request, {
      email: originalEmail,
      name: 'Email Lock Tester',
      is_gm: true,
    });

    await loginTestUser(page, {
      email: user.email,
      name: user.name,
      is_gm: true,
    });

    const result = await supabaseRestCall(page, {
      path: `/rest/v1/users?id=eq.${user.id}`,
      method: 'PATCH',
      body: { email: `hacked-${ts}@evil.local` },
    });

    expect(result.status).toBe(200);
    const rows = result.data as { email: string }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].email).toBe(originalEmail);
  });

  test('user CAN update allowlisted columns (name, timezone, time_format)', async ({
    page,
    request,
  }) => {
    const ts = Date.now();
    const user = await createTestUser(request, {
      email: `allowlist-test-${ts}@e2e.local`,
      name: 'Original Name',
      is_gm: true,
    });

    await loginTestUser(page, {
      email: user.email,
      name: user.name,
      is_gm: true,
    });

    const result = await supabaseRestCall(page, {
      path: `/rest/v1/users?id=eq.${user.id}`,
      method: 'PATCH',
      body: { name: 'Updated Name', timezone: 'Europe/London', time_format: '24h' },
    });

    expect(result.status).toBe(200);
    const rows = result.data as { name: string; timezone: string; time_format: string }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].name).toBe('Updated Name');
    expect(rows[0].timezone).toBe('Europe/London');
    expect(rows[0].time_format).toBe('24h');
  });

  test('service role can update frozen columns (admin operations)', async ({ request }) => {
    const ts = Date.now();
    const user = await createTestUser(request, {
      email: `admin-target-${ts}@e2e.local`,
      name: 'Admin Target',
      is_gm: true,
    });

    // Service role (admin client) should be able to set is_admin
    const admin = getAdminClient();
    const { error } = await admin
      .from('users')
      .update({ is_admin: true })
      .eq('id', user.id);

    expect(error).toBeNull();

    // Verify it was set
    const { data: dbUser } = await admin
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    expect(dbUser?.is_admin).toBe(true);
  });
});

test.describe('Users Table Explicit Deny Policies (#1)', () => {
  test('user cannot directly insert into users table via REST API', async ({ page, request }) => {
    const ts = Date.now();
    await createTestUser(request, {
      email: `insert-deny-${ts}@e2e.local`,
      name: 'Insert Deny User',
      is_gm: true,
    });

    await loginTestUser(page, {
      email: `insert-deny-${ts}@e2e.local`,
      name: 'Insert Deny User',
      is_gm: true,
    });

    const result = await supabaseRestCall(page, {
      path: '/rest/v1/users',
      method: 'POST',
      body: {
        id: crypto.randomUUID(),
        email: 'fake@fake.local',
        name: 'Fake User',
      },
    });

    // Should be rejected by RLS (403) or conflict/error
    expect(result.status).not.toBe(201);
  });

  test('user cannot directly delete from users table via REST API', async ({ page, request }) => {
    const ts = Date.now();
    const user = await createTestUser(request, {
      email: `delete-deny-${ts}@e2e.local`,
      name: 'Delete Deny User',
      is_gm: true,
    });

    await loginTestUser(page, {
      email: user.email,
      name: user.name,
      is_gm: true,
    });

    await supabaseRestCall(page, {
      path: `/rest/v1/users?id=eq.${user.id}`,
      method: 'DELETE',
    });

    // Verify user still exists in database
    const admin = getAdminClient();
    const { data: dbUser } = await admin
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

    expect(dbUser).not.toBeNull();
  });
});

test.describe('Availability Membership Checks (#2, #3)', () => {
  test('non-member cannot insert availability for a game they do not belong to (#2)', async ({
    page,
    request,
  }) => {
    const ts = Date.now();

    // Create a GM with a game
    const gm = await createTestUser(request, {
      email: `gm-avail-deny-${ts}@e2e.local`,
      name: 'Avail Deny GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'No Access Game',
      play_days: [5, 6],
    });

    // Create a non-member user
    const outsider = await createTestUser(request, {
      email: `outsider-avail-${ts}@e2e.local`,
      name: 'Outsider',
      is_gm: true,
    });

    await loginTestUser(page, {
      email: outsider.email,
      name: outsider.name,
      is_gm: true,
    });

    const playDates = getPlayDates([5, 6], 2);

    // Attempt to insert availability via REST API as non-member
    const result = await supabaseRestCall(page, {
      path: '/rest/v1/availability',
      method: 'POST',
      body: {
        user_id: outsider.id,
        game_id: game.id,
        date: playDates[0],
        status: 'available',
      },
    });

    // Should be rejected by RLS (403)
    expect(result.status).toBe(403);

    // Verify no row was inserted
    const admin = getAdminClient();
    const { data: rows } = await admin
      .from('availability')
      .select('id')
      .eq('user_id', outsider.id)
      .eq('game_id', game.id);

    expect(rows).toHaveLength(0);
  });

  test('member CAN insert availability for their game (positive test)', async ({
    page,
    request,
  }) => {
    const ts = Date.now();

    const gm = await createTestUser(request, {
      email: `gm-avail-allow-${ts}@e2e.local`,
      name: 'Avail Allow GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Accessible Game',
      play_days: [5, 6],
    });

    const player = await createTestUser(request, {
      email: `player-avail-allow-${ts}@e2e.local`,
      name: 'Allowed Player',
      is_gm: false,
    });
    await addPlayerToGame(game.id, player.id);

    await loginTestUser(page, {
      email: player.email,
      name: player.name,
      is_gm: false,
    });

    const playDates = getPlayDates([5, 6], 2);

    const result = await supabaseRestCall(page, {
      path: '/rest/v1/availability',
      method: 'POST',
      body: {
        user_id: player.id,
        game_id: game.id,
        date: playDates[0],
        status: 'available',
      },
    });

    // Should succeed (201 Created)
    expect(result.status).toBe(201);
  });

  test('ex-member cannot update availability after being removed (#3)', async ({
    page,
    request,
  }) => {
    const ts = Date.now();

    const gm = await createTestUser(request, {
      email: `gm-exmember-${ts}@e2e.local`,
      name: 'Ex-Member GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Ex-Member Game',
      play_days: [5, 6],
    });

    const player = await createTestUser(request, {
      email: `player-exmember-${ts}@e2e.local`,
      name: 'Soon Ex-Member',
      is_gm: false,
    });
    await addPlayerToGame(game.id, player.id);

    // Set availability while still a member (via admin, bypassing RLS)
    const playDates = getPlayDates([5, 6], 2);
    await setAvailability(player.id, game.id, [
      { date: playDates[0], status: 'available' },
    ]);

    // Remove the player from the game (via admin)
    const admin = getAdminClient();
    await admin
      .from('game_memberships')
      .delete()
      .eq('game_id', game.id)
      .eq('user_id', player.id);

    // Login as the removed player
    await loginTestUser(page, {
      email: player.email,
      name: player.name,
      is_gm: false,
    });

    // Attempt to update the stale availability row via REST API
    const result = await supabaseRestCall(page, {
      path: `/rest/v1/availability?user_id=eq.${player.id}&game_id=eq.${game.id}&date=eq.${playDates[0]}`,
      method: 'PATCH',
      body: { status: 'unavailable' },
    });

    // The PATCH should return 200 but with empty array (no rows matched the RLS filter)
    expect(result.status).toBe(200);
    expect(result.data).toHaveLength(0);

    // Verify the original row is unchanged
    const { data: dbRow } = await admin
      .from('availability')
      .select('status')
      .eq('user_id', player.id)
      .eq('game_id', game.id)
      .eq('date', playDates[0])
      .single();

    expect(dbRow?.status).toBe('available');
  });
});

test.describe('Game Memberships WITH CHECK (#11)', () => {
  test('GM cannot move a membership to a different game via UPDATE', async ({ page, request }) => {
    const ts = Date.now();

    // Create a GM who owns two games
    const gm = await createTestUser(request, {
      email: `gm-move-member-${ts}@e2e.local`,
      name: 'Move Member GM',
      is_gm: true,
    });

    const game1 = await createTestGame({
      gm_id: gm.id,
      name: 'Source Game',
      play_days: [5],
    });

    const game2 = await createTestGame({
      gm_id: gm.id,
      name: 'Target Game',
      play_days: [6],
    });

    // Add a player to game1
    const player = await createTestUser(request, {
      email: `player-move-${ts}@e2e.local`,
      name: 'Moved Player',
      is_gm: false,
    });
    await addPlayerToGame(game1.id, player.id);

    // Login as the GM
    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    // Attempt to update game_id on the membership to move player to game2
    const result = await supabaseRestCall(page, {
      path: `/rest/v1/game_memberships?game_id=eq.${game1.id}&user_id=eq.${player.id}`,
      method: 'PATCH',
      body: { game_id: game2.id },
    });

    // The trigger raises an exception, which PostgREST returns as 400.
    // Any non-2xx status or an empty result set means the move was blocked.
    const blocked =
      result.status >= 400 ||
      (result.status === 200 && Array.isArray(result.data) && (result.data as unknown[]).length === 0);
    expect(blocked).toBe(true);

    // Verify player is still in game1, not game2
    const admin = getAdminClient();
    const { data: game1Members } = await admin
      .from('game_memberships')
      .select('user_id')
      .eq('game_id', game1.id)
      .eq('user_id', player.id);

    expect(game1Members).toHaveLength(1);

    const { data: game2Members } = await admin
      .from('game_memberships')
      .select('user_id')
      .eq('game_id', game2.id)
      .eq('user_id', player.id);

    expect(game2Members).toHaveLength(0);
  });
});
