import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame, addPlayerToGame, setAvailability, getPlayDates } from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Delete Game', () => {
  test('GM sees Delete Game button', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-delete-view-${Date.now()}@e2e.local`,
      name: 'Delete View GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Delete View Game',
      play_days: [5, 6],
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    await expect(page.getByRole('button', { name: /delete game/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
  });

  test('player does not see Delete Game button', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-no-delete-${Date.now()}@e2e.local`,
      name: 'No Delete GM',
      is_gm: true,
    });

    const player = await createTestUser(request, {
      email: `player-no-delete-${Date.now()}@e2e.local`,
      name: 'No Delete Player',
      is_gm: false,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'No Delete Game',
      play_days: [5, 6],
    });

    await addPlayerToGame(game.id, player.id);

    await loginTestUser(page, {
      email: player.email,
      name: player.name,
      is_gm: false,
    });

    await page.goto(`/games/${game.id}`);

    // Wait for page to load
    await expect(page.getByText('No Delete Game')).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Player should NOT see Delete Game button
    await expect(page.getByRole('button', { name: /delete game/i })).not.toBeVisible();
  });

  test('GM can delete game via confirmation modal', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-delete-${Date.now()}@e2e.local`,
      name: 'Delete GM',
      is_gm: true,
    });

    const player = await createTestUser(request, {
      email: `player-delete-${Date.now()}@e2e.local`,
      name: 'Delete Player',
      is_gm: false,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Game To Delete',
      play_days: [5, 6],
    });

    await addPlayerToGame(game.id, player.id);

    // Set some availability for the player
    const playDates = getPlayDates([5, 6], 2);
    await setAvailability(player.id, game.id, [
      { date: playDates[0], is_available: true },
    ]);

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Wait for page to load
    await expect(page.getByRole('button', { name: /delete game/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Click Delete Game button
    await page.getByRole('button', { name: /delete game/i }).click();

    // Confirmation modal should appear
    await expect(page.getByText(/are you sure you want to permanently delete/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });
    await expect(page.getByRole('strong').getByText('Game To Delete')).toBeVisible();

    // Confirm deletion - there are two "Delete Game" buttons:
    // 1. The trigger button (already clicked above)
    // 2. The confirmation button inside the modal
    // Use .last() to get the modal's delete button since the trigger is first in DOM
    await page.getByRole('button', { name: /^delete game$/i }).last().click();

    // Should be redirected to dashboard
    await expect(page).toHaveURL(/\/dashboard/, {
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Game should no longer appear on dashboard
    await expect(page.getByRole('heading', { name: 'Game To Delete' })).not.toBeVisible();
  });

  test('GM can cancel deleting game via modal', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-cancel-delete-${Date.now()}@e2e.local`,
      name: 'Cancel Delete GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Cancel Delete Game',
      play_days: [5, 6],
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Wait for page to load
    await expect(page.getByRole('button', { name: /delete game/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Click Delete Game button
    await page.getByRole('button', { name: /delete game/i }).click();

    // Modal should appear
    await expect(page.getByText(/are you sure you want to permanently delete/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Click Cancel
    await page.getByRole('button', { name: /cancel/i }).click();

    // Modal should close
    await expect(page.getByText(/are you sure you want to permanently delete/i)).not.toBeVisible();

    // Still on game page
    await expect(page.getByText('Cancel Delete Game')).toBeVisible();
  });

  // Note: "deleted game no longer appears on dashboard" test removed as redundant.
  // The "GM can delete game via confirmation modal" test already verifies this behavior.
});
