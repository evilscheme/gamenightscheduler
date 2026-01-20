import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import {
  createTestGame,
  addPlayerToGame,
  setCoGmStatus,
  setAvailability,
  getPlayDates,
} from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Co-GM Feature', () => {
  test.describe('GM can manage co-GMs', () => {
    test('GM can promote a member to co-GM', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-cogm-promote-${Date.now()}@e2e.local`,
        name: 'Promote GM',
        is_gm: true,
      });

      const player = await createTestUser(request, {
        email: `player-cogm-promote-${Date.now()}@e2e.local`,
        name: 'Promotable Player',
        is_gm: false,
      });

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Co-GM Promotion Campaign',
        play_days: [5, 6],
      });

      await addPlayerToGame(game.id, player.id);

      await loginTestUser(page, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);
      await expect(page.getByRole('heading', { name: game.name })).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Find the player row and click "Make Co-GM"
      const playerRow = page.locator('li').filter({ hasText: player.name });
      await expect(playerRow.getByRole('button', { name: /make co-gm/i })).toBeVisible();
      await playerRow.getByRole('button', { name: /make co-gm/i }).click();

      // Verify the Co-GM badge appears
      await expect(playerRow.getByText('Co-GM')).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Button should now say "Remove Co-GM"
      await expect(playerRow.getByRole('button', { name: /remove co-gm/i })).toBeVisible();
    });

    test('GM can demote a co-GM', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-cogm-demote-${Date.now()}@e2e.local`,
        name: 'Demote GM',
        is_gm: true,
      });

      const player = await createTestUser(request, {
        email: `player-cogm-demote-${Date.now()}@e2e.local`,
        name: 'Demotable Player',
        is_gm: false,
      });

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Co-GM Demotion Campaign',
        play_days: [5, 6],
      });

      await addPlayerToGame(game.id, player.id);
      await setCoGmStatus(game.id, player.id, true);

      await loginTestUser(page, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);
      await expect(page.getByRole('heading', { name: game.name })).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Find the player row and verify Co-GM badge exists
      const playerRow = page.locator('li').filter({ hasText: player.name });
      await expect(playerRow.locator('span').filter({ hasText: /^Co-GM$/ })).toBeVisible();

      // Click "Remove Co-GM"
      await playerRow.getByRole('button', { name: /remove co-gm/i }).click();

      // Verify the Co-GM badge is gone (the span with exact text "Co-GM")
      await expect(playerRow.locator('span').filter({ hasText: /^Co-GM$/ })).not.toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Button should now say "Make Co-GM"
      await expect(playerRow.getByRole('button', { name: /make co-gm/i })).toBeVisible();
    });
  });

  test.describe('Co-GM permissions', () => {
    test('co-GM can edit game settings', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-cogm-edit-${Date.now()}@e2e.local`,
        name: 'Edit Test GM',
        is_gm: true,
      });

      const coGm = await createTestUser(request, {
        email: `cogm-edit-${Date.now()}@e2e.local`,
        name: 'Co-GM Editor',
        is_gm: true, // Needs GM mode enabled to see edit page
      });

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Editable Campaign',
        play_days: [5, 6],
      });

      await addPlayerToGame(game.id, coGm.id);
      await setCoGmStatus(game.id, coGm.id, true);

      await loginTestUser(page, {
        email: coGm.email,
        name: coGm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);
      await expect(page.getByRole('heading', { name: game.name })).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Co-GM should see the Edit button
      await expect(page.getByRole('button', { name: /^edit$/i })).toBeVisible();
      await page.getByRole('button', { name: /^edit$/i }).click();

      // Should navigate to edit page
      await expect(page.getByRole('heading', { name: /edit game/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Wait for form to load - use placeholder text to find the input
      const gameNameInput = page.getByPlaceholder(/friday night/i);
      await expect(gameNameInput).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Make a change
      const newName = `Updated Campaign ${Date.now()}`;
      await gameNameInput.fill(newName);
      await page.getByRole('button', { name: /save changes/i }).click();

      // Should redirect back to game detail
      await expect(page.getByRole('heading', { name: newName })).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });
    });

    test('co-GM can confirm sessions', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-cogm-session-${Date.now()}@e2e.local`,
        name: 'Session Test GM',
        is_gm: true,
      });

      const coGm = await createTestUser(request, {
        email: `cogm-session-${Date.now()}@e2e.local`,
        name: 'Co-GM Session',
        is_gm: true,
      });

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Session Campaign',
        play_days: [5, 6],
      });

      await addPlayerToGame(game.id, coGm.id);
      await setCoGmStatus(game.id, coGm.id, true);

      // Set availability for both users
      const playDates = getPlayDates([5, 6], 4);
      await setAvailability(gm.id, game.id, [{ date: playDates[0], status: 'available' }]);
      await setAvailability(coGm.id, game.id, [{ date: playDates[0], status: 'available' }]);

      await loginTestUser(page, {
        email: coGm.email,
        name: coGm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);
      await page.getByRole('button', { name: /schedule/i }).click();

      await expect(page.getByText(/date suggestions/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Co-GM should be able to confirm a session
      await page.getByRole('button', { name: /^confirm$/i }).first().click();
      await expect(page.getByRole('heading', { name: /schedule session/i })).toBeVisible();
      await page.getByRole('button', { name: /confirm session/i }).click();

      // Should see confirmed session
      await expect(page.getByText(/confirmed sessions/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });

    test('co-GM can remove regular players', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-cogm-remove-${Date.now()}@e2e.local`,
        name: 'Remove Test GM',
        is_gm: true,
      });

      const coGm = await createTestUser(request, {
        email: `cogm-remove-${Date.now()}@e2e.local`,
        name: 'Co-GM Remover',
        is_gm: true,
      });

      const player = await createTestUser(request, {
        email: `player-remove-${Date.now()}@e2e.local`,
        name: 'Removable Player',
        is_gm: false,
      });

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Remove Player Campaign',
        play_days: [5, 6],
      });

      await addPlayerToGame(game.id, coGm.id);
      await setCoGmStatus(game.id, coGm.id, true);
      await addPlayerToGame(game.id, player.id);

      await loginTestUser(page, {
        email: coGm.email,
        name: coGm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);
      await expect(page.getByRole('heading', { name: game.name })).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Find the regular player row
      const playerRow = page.locator('li').filter({ hasText: player.name });
      await expect(playerRow.getByRole('button', { name: /^remove$/i })).toBeVisible();
      await playerRow.getByRole('button', { name: /^remove$/i }).click();

      // Wait for confirmation modal to appear - the modal has a fixed position overlay
      const modalOverlay = page.locator('.fixed.inset-0');
      await expect(modalOverlay).toBeVisible({ timeout: TEST_TIMEOUTS.DEFAULT });

      // The modal has the heading "Remove Player?"
      await expect(page.getByText(/remove player\?/i)).toBeVisible();

      // Click the danger button in the modal which says "Remove Player"
      // There should only be one button with variant="danger" that says "Remove Player"
      await page.locator('.fixed.inset-0').getByRole('button', { name: /^remove player$/i }).click();

      // Wait for the modal to close
      await expect(modalOverlay).not.toBeVisible({ timeout: TEST_TIMEOUTS.DEFAULT });

      // Reload to verify the deletion persisted
      await page.reload();
      await expect(page.getByRole('heading', { name: game.name })).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Player should be gone from the list
      await expect(page.locator('li').filter({ hasText: player.name })).not.toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    });
  });

  test.describe('Co-GM restrictions', () => {
    test('co-GM cannot remove other co-GMs', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-cogm-restrict-${Date.now()}@e2e.local`,
        name: 'Restrict Test GM',
        is_gm: true,
      });

      const coGm1 = await createTestUser(request, {
        email: `cogm1-restrict-${Date.now()}@e2e.local`,
        name: 'Co-GM One',
        is_gm: true,
      });

      const coGm2 = await createTestUser(request, {
        email: `cogm2-restrict-${Date.now()}@e2e.local`,
        name: 'Co-GM Two',
        is_gm: true,
      });

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Co-GM Restriction Campaign',
        play_days: [5, 6],
      });

      await addPlayerToGame(game.id, coGm1.id);
      await setCoGmStatus(game.id, coGm1.id, true);
      await addPlayerToGame(game.id, coGm2.id);
      await setCoGmStatus(game.id, coGm2.id, true);

      await loginTestUser(page, {
        email: coGm1.email,
        name: coGm1.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);
      await expect(page.getByRole('heading', { name: game.name })).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Find the other co-GM's row
      const coGm2Row = page.locator('li').filter({ hasText: coGm2.name });
      await expect(coGm2Row.locator('span').filter({ hasText: /^Co-GM$/ })).toBeVisible();

      // Should NOT have a Remove button for the other co-GM
      await expect(coGm2Row.getByRole('button', { name: /^remove$/i })).not.toBeVisible();
    });

    test('co-GM cannot delete the game', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-cogm-delete-${Date.now()}@e2e.local`,
        name: 'Delete Test GM',
        is_gm: true,
      });

      const coGm = await createTestUser(request, {
        email: `cogm-delete-${Date.now()}@e2e.local`,
        name: 'Co-GM Deleter',
        is_gm: true,
      });

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Undeletable Campaign',
        play_days: [5, 6],
      });

      await addPlayerToGame(game.id, coGm.id);
      await setCoGmStatus(game.id, coGm.id, true);

      await loginTestUser(page, {
        email: coGm.email,
        name: coGm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);
      await expect(page.getByRole('heading', { name: game.name })).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Co-GM should see Edit button but NOT Delete button
      await expect(page.getByRole('button', { name: /^edit$/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /delete game/i })).not.toBeVisible();
    });

    test('co-GM cannot see co-GM management buttons', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-cogm-mgmt-${Date.now()}@e2e.local`,
        name: 'Mgmt Test GM',
        is_gm: true,
      });

      const coGm = await createTestUser(request, {
        email: `cogm-mgmt-${Date.now()}@e2e.local`,
        name: 'Co-GM Manager',
        is_gm: true,
      });

      const player = await createTestUser(request, {
        email: `player-mgmt-${Date.now()}@e2e.local`,
        name: 'Regular Player',
        is_gm: false,
      });

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Management Campaign',
        play_days: [5, 6],
      });

      await addPlayerToGame(game.id, coGm.id);
      await setCoGmStatus(game.id, coGm.id, true);
      await addPlayerToGame(game.id, player.id);

      await loginTestUser(page, {
        email: coGm.email,
        name: coGm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);
      await expect(page.getByRole('heading', { name: game.name })).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Co-GM should NOT see "Make Co-GM" or "Remove Co-GM" buttons
      await expect(page.getByRole('button', { name: /make co-gm/i })).not.toBeVisible();
      await expect(page.getByRole('button', { name: /remove co-gm/i })).not.toBeVisible();
    });
  });

  test.describe('Dashboard display', () => {
    test('co-GM badge appears on dashboard', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-cogm-dashboard-${Date.now()}@e2e.local`,
        name: 'Dashboard GM',
        is_gm: true,
      });

      const coGm = await createTestUser(request, {
        email: `cogm-dashboard-${Date.now()}@e2e.local`,
        name: 'Dashboard Co-GM',
        is_gm: true,
      });

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Dashboard Campaign',
        play_days: [5, 6],
      });

      await addPlayerToGame(game.id, coGm.id);
      await setCoGmStatus(game.id, coGm.id, true);

      await loginTestUser(page, {
        email: coGm.email,
        name: coGm.name,
        is_gm: true,
      });

      await page.goto('/dashboard');
      await expect(page.getByRole('heading', { name: /your games/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Find the game card
      const gameCard = page.locator('a').filter({ hasText: game.name });
      await expect(gameCard).toBeVisible();

      // Should show Co-GM badge
      await expect(gameCard.getByText('Co-GM')).toBeVisible();
    });
  });
});
