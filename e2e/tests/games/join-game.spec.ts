import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame, addPlayerToGame } from '../../helpers/seed';

test.describe('Join Game', () => {
  test('player can join a game via invite link', async ({ page, request }) => {
    // Create a GM and a game using the admin API (doesn't need browser auth)
    const gm = await createTestUser(request, {
      email: `gm-join-${Date.now()}@e2e.local`,
      name: 'Join Test GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Join Test Campaign',
      invite_code: `join-${Date.now()}`,
      play_days: [5, 6],
    });

    // Create a player user and login with page context
    await loginTestUser(page, {
      email: `player-join-${Date.now()}@e2e.local`,
      name: 'Joining Player',
      is_gm: false,
    });

    // Navigate to join page
    await page.goto(`/games/join/${game.invite_code}`);
    
    // Should see invitation message (wait for page to load)
    await expect(page.getByText(/you've been invited/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/join test campaign/i)).toBeVisible();
    await expect(page.getByText(/join test gm/i)).toBeVisible();

    // Click join button
    await page.getByRole('button', { name: /join game/i }).click();

    // Should redirect to game detail page
    await expect(page).toHaveURL(/\/games\/[a-f0-9-]+$/, { timeout: 10000 });
  });

  test('existing member sees "already in game" message', async ({ page, request }) => {
    // Create a GM and a game
    const gm = await createTestUser(request, {
      email: `gm-already-${Date.now()}@e2e.local`,
      name: 'Already Test GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Already Member Campaign',
      invite_code: `already-${Date.now()}`,
      play_days: [5],
    });

    // Create player first via admin API
    const player = await createTestUser(request, {
      email: `player-already-${Date.now()}@e2e.local`,
      name: 'Already Member',
      is_gm: false,
    });

    // Add player to game via seed helper
    await addPlayerToGame(game.id, player.id);

    // Now login as that player via page context
    await loginTestUser(page, {
      email: player.email,
      name: player.name,
      is_gm: false,
    });

    // Navigate to join page
    await page.goto(`/games/join/${game.invite_code}`);
    
    // Should see "already in game" message (wait for page to load)
    await expect(page.getByText(/you're already in this game/i)).toBeVisible({ timeout: 10000 });

    // Should see "Go to Game" button instead of "Join Game"
    await expect(page.getByRole('button', { name: /go to game/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /join game/i })).not.toBeVisible();
  });

  test('GM sees "already in game" message for their own game', async ({ page, request }) => {
    // Create a GM
    const gm = await createTestUser(request, {
      email: `gm-own-${Date.now()}@e2e.local`,
      name: 'Own Game GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Own Game Campaign',
      invite_code: `own-${Date.now()}`,
      play_days: [5, 6],
    });

    // Login as the GM
    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    // Navigate to join page as the GM
    await page.goto(`/games/join/${game.invite_code}`);
    
    // Should see "already in game" message (wait for page to load)
    await expect(page.getByText(/you're already in this game/i)).toBeVisible({ timeout: 10000 });
  });

  test('shows error for invalid invite code', async ({ page }) => {
    // Create a user
    await loginTestUser(page, {
      email: `player-invalid-${Date.now()}@e2e.local`,
      name: 'Invalid Code Player',
      is_gm: false,
    });

    // Navigate to join page with invalid code
    await page.goto('/games/join/invalid-code-12345');
    
    // Should see error message (wait for page to load)
    await expect(page.getByText(/game not found/i)).toBeVisible({ timeout: 10000 });
  });

  test('unauthenticated user is redirected to login', async ({ page }) => {
    // Try to access join page without authentication
    await page.goto('/games/join/some-invite-code');

    // Should be redirected to login with callback URL
    await expect(page).toHaveURL(/\/login\?callbackUrl=.*join.*some-invite-code/, { timeout: 10000 });
  });
});
