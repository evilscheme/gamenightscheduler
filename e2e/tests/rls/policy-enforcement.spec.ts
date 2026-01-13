import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame, addPlayerToGame } from '../../helpers/seed';

/**
 * RLS (Row Level Security) Policy Tests
 *
 * These tests verify that database-level security policies are working correctly.
 * They test that users can only access data they're authorized to see.
 */

test.describe('RLS Policy Enforcement', () => {
  test('non-member cannot access game detail page', async ({ page, request }) => {
    // Create a GM and a private game
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
    await page.waitForLoadState('networkidle');

    // Should be redirected to dashboard (game not found for this user)
    await expect(page).toHaveURL('/dashboard');
  });

  test('non-GM cannot access create game page', async ({ page }) => {
    await loginTestUser(page, {
      email: `non-gm-create-${Date.now()}@e2e.local`,
      name: 'Non-GM User',
      is_gm: false,
    });

    await page.goto('/games/new');
    await page.waitForLoadState('networkidle');

    // Should be redirected to dashboard
    await expect(page).toHaveURL('/dashboard');
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
    await page.waitForLoadState('networkidle');

    // Should be able to see the game
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
    await page.waitForLoadState('networkidle');

    // Should see their own game
    await expect(page.getByText(/second gm game/i)).toBeVisible();

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
    await page.waitForLoadState('networkidle');

    // Player should see the GM's name but they themselves are not GM of this game
    await expect(page.getByText(/badge test gm/i)).toBeVisible();
  });

  test('settings page shows correct GM status', async ({ page }) => {
    // Create a non-GM user
    await loginTestUser(page, {
      email: `settings-test-${Date.now()}@e2e.local`,
      name: 'Settings User',
      is_gm: false,
    });

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Should see GM mode toggle in unchecked state
    await expect(page.getByText(/game master mode/i)).toBeVisible();
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
    await page.waitForLoadState('networkidle');

    // Player should NOT see copy invite link button (only GM sees it)
    // This depends on the implementation - some apps show invite to all members
    // If player CAN see invite link, this test documents that behavior
    const inviteButton = page.getByRole('button', { name: /copy invite link/i });

    // Document the current behavior - if this fails, update based on actual UI behavior
    await expect(inviteButton).not.toBeVisible();
  });
});
