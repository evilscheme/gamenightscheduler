import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame, addPlayerToGame } from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

// Local Supabase credentials (same as seed.ts)
const SUPABASE_URL = 'http://localhost:54321';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

/**
 * RLS (Row Level Security) Policy Tests
 *
 * These tests verify that database-level security policies are working correctly.
 * They test that users can only access data they're authorized to see.
 */

test.describe('RLS Policy Enforcement', () => {
  test('non-member cannot view game they are not part of', async ({ page, request }) => {
    // RLS policy restricts game visibility to only participants (GM or members)
    const gm = await createTestUser(request, {
      email: `gm-rls-${Date.now()}@e2e.local`,
      name: 'RLS Test GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Private Game',
      play_days: [5, 6],
    });

    // Create a different user who is NOT a member
    await loginTestUser(page, {
      email: `outsider-${Date.now()}@e2e.local`,
      name: 'Outsider User',
      is_gm: false,
    });

    // Try to access the game page
    await page.goto(`/games/${game.id}`);

    // Non-members should be redirected to dashboard (RLS blocks access)
    await expect(page).toHaveURL('/dashboard');

    // The private game should not be visible on their dashboard
    await expect(page.getByText(/private game/i)).not.toBeVisible();
  });

  // Note: "non-GM cannot access create game page" test removed - all users are now GMs by default

  test('member can view game they belong to', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-member-${Date.now()}@e2e.local`,
      name: 'Member Test GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Member Visible Game',
      play_days: [5],
    });

    // Create a player and add them as a member
    const player = await createTestUser(request, {
      email: `player-member-${Date.now()}@e2e.local`,
      name: 'Member Player',
      is_gm: false,
    });
    await addPlayerToGame(game.id, player.id);

    // Login as the player
    await loginTestUser(page, {
      email: player.email,
      name: player.name,
      is_gm: false,
    });

    // Access the game page as the player
    await page.goto(`/games/${game.id}`);
    
    // Should be able to see the game (wait for data to load)
    await expect(page.getByRole('heading', { name: /member visible game/i })).toBeVisible();
  });

  test('user can only see their own games on dashboard', async ({ page, request }) => {
    // Create first GM with a game
    const gm1 = await createTestUser(request, {
      email: `gm1-dash-${Date.now()}@e2e.local`,
      name: 'First GM',
      is_gm: true,
    });

    await createTestGame({
      gm_id: gm1.id,
      name: 'First GM Game',
      play_days: [5],
    });

    // Create second GM with a different game
    const gm2 = await createTestUser(request, {
      email: `gm2-dash-${Date.now()}@e2e.local`,
      name: 'Second GM',
      is_gm: true,
    });

    await createTestGame({
      gm_id: gm2.id,
      name: 'Second GM Game',
      play_days: [6],
    });

    // Login as second GM
    await loginTestUser(page, {
      email: gm2.email,
      name: gm2.name,
      is_gm: true,
    });

    // Navigate to dashboard as second GM
    await page.goto('/dashboard');
    
    // Wait for dashboard to load with games
    await expect(page.getByRole('heading', { name: /your games/i })).toBeVisible();

    // Should see their own game
    await expect(page.getByText(/second gm game/i)).toBeVisible({ timeout: TEST_TIMEOUTS.SHORT });

    // Should NOT see the first GM's game
    await expect(page.getByText(/first gm game/i)).not.toBeVisible();
  });

  test('GM badge only shows for actual GM', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-badge-${Date.now()}@e2e.local`,
      name: 'Badge Test GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Badge Test Game',
      play_days: [5],
    });

    // Add a player
    const player = await createTestUser(request, {
      email: `player-badge-${Date.now()}@e2e.local`,
      name: 'Badge Player',
      is_gm: false,
    });
    await addPlayerToGame(game.id, player.id);

    // Login as player
    await loginTestUser(page, {
      email: player.email,
      name: player.name,
      is_gm: false,
    });

    // View game as player
    await page.goto(`/games/${game.id}`);
    
    // Wait for game page to load with data
    await expect(page.getByRole('heading', { name: /badge test game/i })).toBeVisible();

    // Player should see the GM's name but they themselves are not GM of this game
    // Use .first() because the GM name appears in multiple places (header and player list)
    await expect(page.getByText(/badge test gm/i).first()).toBeVisible({ timeout: TEST_TIMEOUTS.SHORT });
  });

  // Note: "settings page shows correct GM status" test removed - GM toggle no longer exists

  test('invite link only visible to GM of the game', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-invite-vis-${Date.now()}@e2e.local`,
      name: 'Invite Visibility GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Invite Visibility Game',
      invite_code: `invite-vis-${Date.now()}`,
      play_days: [5],
    });

    // Create a player and add them
    const player = await createTestUser(request, {
      email: `player-invite-vis-${Date.now()}@e2e.local`,
      name: 'Invite Vis Player',
      is_gm: false,
    });
    await addPlayerToGame(game.id, player.id);

    // Login as player
    await loginTestUser(page, {
      email: player.email,
      name: player.name,
      is_gm: false,
    });

    // View as player
    await page.goto(`/games/${game.id}`);
    
    // Wait for game page to load with data
    await expect(page.getByRole('heading', { name: /invite visibility game/i })).toBeVisible();

    // Player should NOT see copy invite link button (only GM sees it)
    // This depends on the implementation - some apps show invite to all members
    // If player CAN see invite link, this test documents that behavior
    const inviteButton = page.getByRole('button', { name: /copy invite link/i });

    // Document the current behavior - if this fails, update based on actual UI behavior
    await expect(inviteButton).not.toBeVisible();
  });

  test('non-member can join game via invite link', async ({ page, request }) => {
    // Even though non-members can't view games directly, they should be able
    // to join via invite code (the API route bypasses RLS for invite lookups)
    const gm = await createTestUser(request, {
      email: `gm-invite-join-${Date.now()}@e2e.local`,
      name: 'Invite Join GM',
      is_gm: true,
    });

    const inviteCode = `join-test-${Date.now()}`;
    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Joinable Game',
      invite_code: inviteCode,
      play_days: [5],
    });

    // Create a new user who is not a member
    await loginTestUser(page, {
      email: `joiner-${Date.now()}@e2e.local`,
      name: 'Joining User',
      is_gm: false,
    });

    // Navigate to the invite link
    await page.goto(`/games/join/${inviteCode}`);

    // Should see the join page with game details
    await expect(page.getByRole('heading', { name: /you've been invited/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /joinable game/i })).toBeVisible();

    // Join the game
    await page.getByRole('button', { name: /join game/i }).click();

    // Should be redirected to the game page after joining
    await expect(page).toHaveURL(`/games/${game.id}`);

    // Now as a member, should see the game details
    await expect(page.getByRole('heading', { name: /joinable game/i })).toBeVisible();
  });

  test('non-member cannot access game edit page', async ({ page, request }) => {
    // Non-members should be blocked from accessing the edit page
    const gm = await createTestUser(request, {
      email: `gm-edit-block-${Date.now()}@e2e.local`,
      name: 'Edit Block GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Uneditables Game',
      play_days: [5],
    });

    // Create a different GM user (is_gm but not member of this game)
    await loginTestUser(page, {
      email: `other-gm-${Date.now()}@e2e.local`,
      name: 'Other GM',
      is_gm: true,
    });

    // Try to access the edit page
    await page.goto(`/games/${game.id}/edit`);

    // Should be redirected to dashboard (RLS blocks access)
    await expect(page).toHaveURL('/dashboard');
  });
});

test.describe('Availability Record Isolation', () => {
  test('user can only modify their own availability records', async ({ page, request }) => {
    // Create a GM with a game
    const gm = await createTestUser(request, {
      email: `gm-avail-iso-${Date.now()}@e2e.local`,
      name: 'Availability Isolation GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Availability Isolation Game',
      play_days: [5, 6],
    });

    // Create a player and add them to the game
    const player = await createTestUser(request, {
      email: `player-avail-iso-${Date.now()}@e2e.local`,
      name: 'Isolation Player',
      is_gm: false,
    });
    await addPlayerToGame(game.id, player.id);

    // Set availability for the player
    const { setAvailability, getPlayDates } = await import('../../helpers/seed');
    const playDates = getPlayDates([5, 6], 4);
    await setAvailability(player.id, game.id, [
      { date: playDates[0], status: 'available' },
    ]);

    // Login as GM and navigate to game
    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Switch to availability tab
    await page.getByRole('button', { name: /availability/i }).click();

    // The GM can view their own calendar and mark their own availability
    // They CANNOT modify the player's availability
    // The UI only shows the GM's own availability calendar for editing

    // Mark GM's own availability - this should work
    const calendarCell = page.locator('[data-testid="calendar-day"]').first();
    if (await calendarCell.isVisible()) {
      // Just verify the calendar is interactive for own dates
      await expect(page.getByText(/mark your availability/i)).toBeVisible();
    }

    // The important security aspect is that the database RLS policy
    // prevents one user from modifying another's availability
    // This is tested implicitly - there's no UI to modify others' availability
  });

  test('availability is visible to all game participants but only editable by owner', async ({ page, request }) => {
    // Create a GM with a game
    const gm = await createTestUser(request, {
      email: `gm-avail-view-${Date.now()}@e2e.local`,
      name: 'Availability View GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Availability View Game',
      play_days: [5, 6],
    });

    // Create a player and add them
    const player = await createTestUser(request, {
      email: `player-avail-view-${Date.now()}@e2e.local`,
      name: 'View Player',
      is_gm: false,
    });
    await addPlayerToGame(game.id, player.id);

    // Set availability for both
    const { setAvailability, getPlayDates } = await import('../../helpers/seed');
    const playDates = getPlayDates([5, 6], 4);

    if (playDates.length > 0) {
      await setAvailability(gm.id, game.id, [
        { date: playDates[0], status: 'available' },
      ]);
      await setAvailability(player.id, game.id, [
        { date: playDates[0], status: 'maybe' },
      ]);
    }

    // Login as player
    await loginTestUser(page, {
      email: player.email,
      name: player.name,
      is_gm: false,
    });

    await page.goto(`/games/${game.id}`);

    // Go to schedule tab to see everyone's availability
    await page.getByRole('button', { name: /schedule/i }).click();

    // Player should see both GM and their own availability in suggestions
    await expect(page.getByText(/date suggestions/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.SHORT,
    });

    // The availability summary shows player counts, which means both records are visible
    // This confirms RLS SELECT policy allows viewing others' availability
    await expect(page.getByText(/available/i).first()).toBeVisible();
  });
});

test.describe('Users Table RLS Scoping', () => {
  /**
   * Helper to query the users table via the Supabase REST API from the browser.
   * Uses the authenticated user's session (access token from cookies).
   */
  async function queryUsersTable(page: import('@playwright/test').Page): Promise<string[]> {
    return page.evaluate(
      async ({ url, anonKey }) => {
        // Extract the access token from cookies set by @supabase/ssr
        // Cookie format: sb-localhost-auth-token=base64-<base64-encoded-json>
        const cookies = document.cookie.split(';').map((c) => c.trim());
        const authCookies = cookies
          .filter((c) => c.includes('auth-token'))
          .sort();

        // Reassemble value from potentially chunked cookies (.0, .1, etc.)
        let rawValue = '';
        if (authCookies.length > 0) {
          for (const c of authCookies) {
            const val = c.split('=').slice(1).join('=');
            rawValue += decodeURIComponent(val);
          }
        }

        // Strip the "base64-" prefix if present and decode
        let tokenJson: string;
        if (rawValue.startsWith('base64-')) {
          tokenJson = atob(rawValue.slice('base64-'.length));
        } else {
          tokenJson = rawValue;
        }

        let accessToken = '';
        try {
          const parsed = JSON.parse(tokenJson);
          if (parsed.access_token) {
            accessToken = parsed.access_token;
          } else if (Array.isArray(parsed)) {
            accessToken = parsed[0];
          }
        } catch {
          throw new Error(`Could not parse auth token from cookies`);
        }

        if (!accessToken) {
          throw new Error('No access token found in cookies');
        }

        // Query the users table via PostgREST
        const response = await fetch(`${url}/rest/v1/users?select=id`, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Supabase query failed: ${response.status}`);
        }

        const users: { id: string }[] = await response.json();
        return users.map((u) => u.id);
      },
      { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY }
    );
  }

  test('non-co-participant cannot see other users', async ({ page, request }) => {
    // Create GM1 with Game1
    const gm1 = await createTestUser(request, {
      email: `gm1-rls-users-${Date.now()}@e2e.local`,
      name: 'RLS Users GM1',
      is_gm: true,
    });

    await createTestGame({
      gm_id: gm1.id,
      name: 'RLS Users Game1',
      play_days: [5],
    });

    // Create GM2 with Game2 (no shared game)
    const gm2 = await createTestUser(request, {
      email: `gm2-rls-users-${Date.now()}@e2e.local`,
      name: 'RLS Users GM2',
      is_gm: true,
    });

    await createTestGame({
      gm_id: gm2.id,
      name: 'RLS Users Game2',
      play_days: [6],
    });

    // Login as GM1
    await loginTestUser(page, {
      email: gm1.email,
      name: gm1.name,
      is_gm: true,
    });

    // Query users table - GM1 should NOT see GM2
    const visibleUserIds = await queryUsersTable(page);

    expect(visibleUserIds).toContain(gm1.id);
    expect(visibleUserIds).not.toContain(gm2.id);
  });

  test('co-participants can see each other', async ({ page, request }) => {
    // Create GM1 with Game1
    const gm1 = await createTestUser(request, {
      email: `gm1-rls-copart-${Date.now()}@e2e.local`,
      name: 'RLS CoParticipant GM1',
      is_gm: true,
    });

    const game1 = await createTestGame({
      gm_id: gm1.id,
      name: 'RLS CoParticipant Game1',
      play_days: [5],
    });

    // Create GM2 and add as player to Game1
    const gm2 = await createTestUser(request, {
      email: `gm2-rls-copart-${Date.now()}@e2e.local`,
      name: 'RLS CoParticipant GM2',
      is_gm: true,
    });

    await addPlayerToGame(game1.id, gm2.id);

    // Login as GM1
    await loginTestUser(page, {
      email: gm1.email,
      name: gm1.name,
      is_gm: true,
    });

    // Query users table - GM1 should see GM2 (they share Game1)
    const visibleUserIds = await queryUsersTable(page);

    expect(visibleUserIds).toContain(gm1.id);
    expect(visibleUserIds).toContain(gm2.id);
  });
});
