import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame, addPlayerToGame, setAvailability, getPlayDates } from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Leave and Remove Players', () => {
  test.describe('Player Leaving Game', () => {
    test('player sees Leave Game button', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-leave-view-${Date.now()}@e2e.local`,
        name: 'Leave View GM',
        is_gm: true,
      });

      const player = await createTestUser(request, {
        email: `player-leave-view-${Date.now()}@e2e.local`,
        name: 'Leave View Player',
        is_gm: false,
      });

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Leave View Game',
        play_days: [5, 6],
      });

      await addPlayerToGame(game.id, player.id);

      // Login as player
      await loginTestUser(page, {
        email: player.email,
        name: player.name,
        is_gm: false,
      });

      await page.goto(`/games/${game.id}`);

      // Player should see Leave Game button
      await expect(page.getByRole('button', { name: /leave game/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });
    });

    test('GM does not see Leave Game button', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-no-leave-${Date.now()}@e2e.local`,
        name: 'No Leave GM',
        is_gm: true,
      });

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'No Leave Game',
        play_days: [5, 6],
      });

      // Login as GM
      await loginTestUser(page, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);

      // Wait for page to load
      await expect(page.getByText('No Leave Game')).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // GM should NOT see Leave Game button
      await expect(page.getByRole('button', { name: /leave game/i })).not.toBeVisible();
    });

    test('player can leave game via confirmation modal', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-leave-${Date.now()}@e2e.local`,
        name: 'Leave GM',
        is_gm: true,
      });

      const player = await createTestUser(request, {
        email: `player-leave-${Date.now()}@e2e.local`,
        name: 'Leaving Player',
        is_gm: false,
      });

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Leave Test Game',
        play_days: [5, 6],
      });

      await addPlayerToGame(game.id, player.id);

      // Set some availability for the player
      const playDates = getPlayDates([5, 6], 2);
      await setAvailability(player.id, game.id, [
        { date: playDates[0], is_available: true },
      ]);

      // Login as player
      await loginTestUser(page, {
        email: player.email,
        name: player.name,
        is_gm: false,
      });

      await page.goto(`/games/${game.id}`);

      // Click Leave Game button
      await page.getByRole('button', { name: /leave game/i }).click();

      // Confirmation modal should appear
      await expect(page.getByText(/are you sure you want to leave/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
      await expect(page.getByText('Leave Test Game', { exact: false })).toBeVisible();

      // Confirm leaving - click the button inside the modal (not the header button)
      const modal = page.locator('.fixed.inset-0');
      await modal.getByRole('button', { name: /^leave game$/i }).click();

      // Should be redirected to dashboard
      await expect(page).toHaveURL(/\/dashboard/, {
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Game should no longer appear (or verify player is no longer in game)
      await expect(page.getByText('Leave Test Game')).not.toBeVisible();
    });

    test('player can cancel leaving via modal', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-cancel-leave-${Date.now()}@e2e.local`,
        name: 'Cancel Leave GM',
        is_gm: true,
      });

      const player = await createTestUser(request, {
        email: `player-cancel-leave-${Date.now()}@e2e.local`,
        name: 'Cancel Leave Player',
        is_gm: false,
      });

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Cancel Leave Game',
        play_days: [5, 6],
      });

      await addPlayerToGame(game.id, player.id);

      // Login as player
      await loginTestUser(page, {
        email: player.email,
        name: player.name,
        is_gm: false,
      });

      await page.goto(`/games/${game.id}`);

      // Click Leave Game button
      await page.getByRole('button', { name: /leave game/i }).click();

      // Modal should appear
      await expect(page.getByText(/are you sure you want to leave/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Click Cancel
      await page.getByRole('button', { name: /cancel/i }).click();

      // Modal should close
      await expect(page.getByText(/are you sure you want to leave/i)).not.toBeVisible();

      // Still on game page
      await expect(page.getByText('Cancel Leave Game')).toBeVisible();
    });
  });

  test.describe('GM Removing Players', () => {
    test('GM sees Remove button for each player', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-remove-view-${Date.now()}@e2e.local`,
        name: 'Remove View GM',
        is_gm: true,
      });

      const player1 = await createTestUser(request, {
        email: `player1-remove-view-${Date.now()}@e2e.local`,
        name: 'Remove View Player1',
        is_gm: false,
      });

      const player2 = await createTestUser(request, {
        email: `player2-remove-view-${Date.now()}@e2e.local`,
        name: 'Remove View Player2',
        is_gm: false,
      });

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Remove View Game',
        play_days: [5, 6],
      });

      await addPlayerToGame(game.id, player1.id);
      await addPlayerToGame(game.id, player2.id);

      // Login as GM
      await loginTestUser(page, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);

      // Wait for players to load
      await expect(page.getByText('Remove View Player1')).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });
      await expect(page.getByText('Remove View Player2')).toBeVisible();

      // GM should see Remove buttons (one per player, not for GM)
      const removeButtons = page.getByRole('button', { name: /remove/i });
      await expect(removeButtons).toHaveCount(2);
    });

    test('player does not see Remove buttons', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-no-remove-${Date.now()}@e2e.local`,
        name: 'No Remove GM',
        is_gm: true,
      });

      const player = await createTestUser(request, {
        email: `player-no-remove-${Date.now()}@e2e.local`,
        name: 'No Remove Player',
        is_gm: false,
      });

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'No Remove Game',
        play_days: [5, 6],
      });

      await addPlayerToGame(game.id, player.id);

      // Login as player
      await loginTestUser(page, {
        email: player.email,
        name: player.name,
        is_gm: false,
      });

      await page.goto(`/games/${game.id}`);

      // Wait for page to load
      await expect(page.getByText('No Remove Player')).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Player should NOT see Remove buttons
      await expect(page.getByRole('button', { name: /remove/i })).not.toBeVisible();
    });

    test('GM can remove player via confirmation modal', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-remove-${Date.now()}@e2e.local`,
        name: 'Remove GM',
        is_gm: true,
      });

      const player = await createTestUser(request, {
        email: `player-remove-${Date.now()}@e2e.local`,
        name: 'Player To Remove',
        is_gm: false,
      });

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Remove Test Game',
        play_days: [5, 6],
      });

      await addPlayerToGame(game.id, player.id);

      // Set some availability for the player
      const playDates = getPlayDates([5, 6], 2);
      await setAvailability(player.id, game.id, [
        { date: playDates[0], is_available: true },
      ]);

      // Login as GM
      await loginTestUser(page, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);

      // Wait for player to load
      await expect(page.getByText('Player To Remove')).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Verify player count shows 2 (GM + player)
      await expect(page.getByText('Players (2)')).toBeVisible();

      // Click Remove button
      await page.getByRole('button', { name: /remove/i }).click();

      // Confirmation modal should appear
      await expect(page.getByText(/are you sure you want to remove/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
      await expect(page.getByText('Player To Remove', { exact: false })).toBeVisible();

      // Confirm removal - click the button inside the modal
      const modal = page.locator('.fixed.inset-0');
      await modal.getByRole('button', { name: /^remove player$/i }).click();

      // Modal should close and player should be removed
      await expect(page.getByText(/are you sure you want to remove/i)).not.toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Player count should now be 1 (just GM)
      await expect(page.getByText('Players (1)')).toBeVisible();

      // Player name should no longer be in the list
      await expect(page.getByText('Player To Remove')).not.toBeVisible();
    });

    test('GM can cancel removing player via modal', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-cancel-remove-${Date.now()}@e2e.local`,
        name: 'Cancel Remove GM',
        is_gm: true,
      });

      const player = await createTestUser(request, {
        email: `player-cancel-remove-${Date.now()}@e2e.local`,
        name: 'Cancel Remove Player',
        is_gm: false,
      });

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Cancel Remove Game',
        play_days: [5, 6],
      });

      await addPlayerToGame(game.id, player.id);

      // Login as GM
      await loginTestUser(page, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);

      // Wait for player to load
      await expect(page.getByText('Cancel Remove Player')).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Click Remove button
      await page.getByRole('button', { name: /remove/i }).click();

      // Modal should appear
      await expect(page.getByText(/are you sure you want to remove/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Click Cancel
      await page.getByRole('button', { name: /cancel/i }).click();

      // Modal should close
      await expect(page.getByText(/are you sure you want to remove/i)).not.toBeVisible();

      // Player should still be in the list
      await expect(page.getByText('Cancel Remove Player')).toBeVisible();
      await expect(page.getByText('Players (2)')).toBeVisible();
    });
  });
});
