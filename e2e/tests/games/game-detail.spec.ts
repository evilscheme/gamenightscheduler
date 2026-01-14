import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame, addPlayerToGame } from '../../helpers/seed';

test.describe('Game Detail Page', () => {
  test('shows game overview with tabs', async ({ page, request }) => {
    // Create a GM and a game
    const gm = await createTestUser(request, {
      email: `gm-detail-${Date.now()}@e2e.local`,
      name: 'Detail Test GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Detail Test Campaign',
      description: 'A campaign for testing details',
      play_days: [5, 6],
    });

    // Login as GM
    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    // Navigate to game detail page
    await page.goto(`/games/${game.id}`);
    
    // Should see game name (wait for profile + data to load)
    await expect(page.getByRole('heading', { name: /detail test campaign/i })).toBeVisible({ timeout: 10000 });

    // Should see tabs
    await expect(page.getByRole('button', { name: /overview/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible();
  });

  test('shows invite link for GM', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-invite-${Date.now()}@e2e.local`,
      name: 'Invite Test GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Invite Test Campaign',
      invite_code: `invite-test-${Date.now()}`,
      play_days: [5],
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);
    
    // Should see copy invite link button (wait for page to load)
    await expect(page.getByRole('button', { name: /copy invite link/i })).toBeVisible({ timeout: 10000 });
  });

  test('player can view game they are member of', async ({ page, request }) => {
    // Create GM and game
    const gm = await createTestUser(request, {
      email: `gm-player-view-${Date.now()}@e2e.local`,
      name: 'Player View GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Player View Campaign',
      play_days: [5, 6],
    });

    // Create player and add to game
    const player = await createTestUser(request, {
      email: `player-view-${Date.now()}@e2e.local`,
      name: 'Viewing Player',
      is_gm: false,
    });
    await addPlayerToGame(game.id, player.id);

    // Login as player
    await loginTestUser(page, {
      email: player.email,
      name: player.name,
      is_gm: false,
    });

    await page.goto(`/games/${game.id}`);
    
    // Should see game name (wait for page to load)
    await expect(page.getByRole('heading', { name: /player view campaign/i })).toBeVisible({ timeout: 10000 });
  });

  test('switching tabs works', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-tabs-${Date.now()}@e2e.local`,
      name: 'Tabs Test GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Tabs Test Campaign',
      play_days: [5, 6],
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);
    
    // Wait for page to load first
    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible({ timeout: 10000 });

    // Click Availability tab
    await page.getByRole('button', { name: /availability/i }).click();

    // Should see availability content
    await expect(page.getByText(/mark your availability/i)).toBeVisible({ timeout: 10000 });

    // Click Schedule tab
    await page.getByRole('button', { name: /schedule/i }).click();

    // Should see scheduling content
    await expect(page.getByText(/date suggestions/i)).toBeVisible({ timeout: 10000 });
  });

  test('shows member list', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-members-${Date.now()}@e2e.local`,
      name: 'Members Test GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Members Test Campaign',
      play_days: [5],
    });

    // Add a player
    const player = await createTestUser(request, {
      email: `player-member-${Date.now()}@e2e.local`,
      name: 'Test Player Member',
      is_gm: false,
    });
    await addPlayerToGame(game.id, player.id);

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);
    
    // Should show both GM and player in members list (wait for page to load)
    // Use the member list section specifically to avoid matching navbar
    await expect(page.getByRole('list').getByText(/members test gm/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('list').getByText(/test player member/i)).toBeVisible({ timeout: 10000 });
  });
});
