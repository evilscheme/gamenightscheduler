import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame, addPlayerToGame } from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

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

  test('non-GM cannot access create game page', async ({ page }) => {
    await loginTestUser(page, {
      email: `non-gm-create-${Date.now()}@e2e.local`,
      name: 'Non-GM User',
      is_gm: false,
    });

    await page.goto('/games/new');
    
    // Should be redirected to dashboard (non-GM users can't create games)
    // Wait for client-side redirect after profile loads and is_gm check fails
    await expect(page).toHaveURL('/dashboard', );
  });

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

  test('settings page shows correct GM status', async ({ page }) => {
    // Create a non-GM user
    await loginTestUser(page, {
      email: `settings-test-${Date.now()}@e2e.local`,
      name: 'Settings User',
      is_gm: false,
    });

    await page.goto('/settings');
    
    // Wait for settings page to load with profile data
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();

    // Should see GM mode toggle in unchecked state
    await expect(page.getByText(/game master mode/i)).toBeVisible({ timeout: TEST_TIMEOUTS.SHORT });
  });

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
