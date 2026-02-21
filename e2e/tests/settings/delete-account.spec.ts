import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import {
  createTestGame,
  addPlayerToGame,
  setAvailability,
  createTestSession,
  getPlayDates,
} from '../../helpers/seed';
import {
  gameExistsInDb,
  getGameGmId,
  availabilityRowsForUser,
  membershipRowsForUser,
  userExistsInDb,
  sessionConfirmedByForGame,
} from '../../helpers/db-assertions';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Delete Account', () => {
  test('user with no games can delete account', async ({ page, request }) => {
    const user = await createTestUser(request, {
      email: `del-nogames-${Date.now()}@e2e.local`,
      name: 'No Games User',
      is_gm: true,
    });

    await loginTestUser(page, {
      email: user.email,
      name: user.name,
      is_gm: true,
    });

    await page.goto('/settings/delete-account');

    // Should skip game decisions and show confirmation directly
    await expect(page.getByText('Type your email to confirm')).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Button should be disabled initially
    const deleteButton = page.getByRole('button', { name: /delete my account/i });
    await expect(deleteButton).toBeDisabled();

    // Type email to enable button
    await page.getByPlaceholder('your@email.com').fill(user.email);
    await expect(deleteButton).toBeEnabled();

    await deleteButton.click();

    // Should redirect to home
    await expect(page).toHaveURL('/', { timeout: TEST_TIMEOUTS.LONG });

    // User should no longer exist
    expect(await userExistsInDb(user.id)).toBe(false);
  });

  test('solo GM game is auto-deleted', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `del-solo-${Date.now()}@e2e.local`,
      name: 'Solo GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Solo Game',
      play_days: [5],
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto('/settings/delete-account');

    // Should show the game as "will be deleted"
    await expect(page.getByText('Solo Game')).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await expect(page.getByText(/only you.*will be deleted/i)).toBeVisible();

    // There should be no dropdown for this game (solo = no transfer option)
    await expect(page.locator('select')).not.toBeVisible();

    // Continue to confirmation
    await page.getByRole('button', { name: /continue/i }).click();

    // Confirm deletion
    await page.getByPlaceholder('your@email.com').fill(gm.email);
    await page.getByRole('button', { name: /delete my account/i }).click();

    await expect(page).toHaveURL('/', { timeout: TEST_TIMEOUTS.LONG });

    expect(await gameExistsInDb(game.id)).toBe(false);
    expect(await userExistsInDb(gm.id)).toBe(false);
  });

  test('user can transfer a game to a member', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `del-transfer-gm-${Date.now()}@e2e.local`,
      name: 'Transfer GM',
      is_gm: true,
    });

    const player = await createTestUser(request, {
      email: `del-transfer-player-${Date.now()}@e2e.local`,
      name: 'Transfer Player',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Transfer Game',
      play_days: [5],
    });

    await addPlayerToGame(game.id, player.id);

    // Add availability for both users
    const playDates = getPlayDates([5], 2);
    await setAvailability(gm.id, game.id, [
      { date: playDates[0], status: 'available' },
    ]);
    await setAvailability(player.id, game.id, [
      { date: playDates[0], status: 'available' },
    ]);

    // GM confirms a session
    await createTestSession({
      game_id: game.id,
      date: playDates[0],
      confirmed_by: gm.id,
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto('/settings/delete-account');

    // Should show the game with transfer option
    await expect(page.getByText('Transfer Game')).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Select transfer to player (select by value = player's user ID)
    const select = page.locator('select');
    await select.selectOption(player.id);

    // Continue to confirmation
    await page.getByRole('button', { name: /continue/i }).click();

    // Verify summary shows transfer
    await expect(page.getByText(/games that will be transferred/i)).toBeVisible();
    await expect(page.getByText(/Transfer Player/)).toBeVisible();

    // Confirm deletion
    await page.getByPlaceholder('your@email.com').fill(gm.email);
    await page.getByRole('button', { name: /delete my account/i }).click();

    await expect(page).toHaveURL('/', { timeout: TEST_TIMEOUTS.LONG });

    // Game should still exist with new GM
    expect(await getGameGmId(game.id)).toBe(player.id);

    // Old GM's data should be cleaned up
    expect(await availabilityRowsForUser(gm.id)).toBe(0);
    expect(await membershipRowsForUser(gm.id)).toBe(0);
    expect(await userExistsInDb(gm.id)).toBe(false);

    // Session should survive with confirmed_by nullified
    const confirmedBy = await sessionConfirmedByForGame(game.id);
    expect(confirmedBy).toEqual([null]);
  });

  test('user can explicitly delete a game with members', async ({
    page,
    request,
  }) => {
    const gm = await createTestUser(request, {
      email: `del-explicit-gm-${Date.now()}@e2e.local`,
      name: 'Delete GM',
      is_gm: true,
    });

    const player = await createTestUser(request, {
      email: `del-explicit-player-${Date.now()}@e2e.local`,
      name: 'Delete Player',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Doomed Game',
      play_days: [6],
    });

    await addPlayerToGame(game.id, player.id);

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto('/settings/delete-account');

    // Should show the game with dropdown defaulting to "Delete this game"
    await expect(page.getByText('Doomed Game')).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Leave default as "Delete this game" — don't change the dropdown
    await page.getByRole('button', { name: /continue/i }).click();

    // Summary should show game in "will be deleted" list
    await expect(page.getByText(/games that will be deleted/i)).toBeVisible();
    await expect(page.getByText('Doomed Game')).toBeVisible();

    // Confirm
    await page.getByPlaceholder('your@email.com').fill(gm.email);
    await page.getByRole('button', { name: /delete my account/i }).click();

    await expect(page).toHaveURL('/', { timeout: TEST_TIMEOUTS.LONG });

    expect(await gameExistsInDb(game.id)).toBe(false);
    expect(await userExistsInDb(gm.id)).toBe(false);
  });

  test('email confirmation is required', async ({ page, request }) => {
    const user = await createTestUser(request, {
      email: `del-email-${Date.now()}@e2e.local`,
      name: 'Email Check User',
      is_gm: true,
    });

    await loginTestUser(page, {
      email: user.email,
      name: user.name,
      is_gm: true,
    });

    await page.goto('/settings/delete-account');

    // Wait for confirmation step (no games = skip to confirmation)
    await expect(page.getByText('Type your email to confirm')).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    const deleteButton = page.getByRole('button', { name: /delete my account/i });

    // Should be disabled initially
    await expect(deleteButton).toBeDisabled();

    // Wrong email — should stay disabled
    await page.getByPlaceholder('your@email.com').fill('wrong@email.com');
    await expect(deleteButton).toBeDisabled();

    // Correct email (case-insensitive)
    await page.getByPlaceholder('your@email.com').fill(user.email.toUpperCase());
    await expect(deleteButton).toBeEnabled();
  });

  test('cancel flow returns to settings', async ({ page, request }) => {
    const user = await createTestUser(request, {
      email: `del-cancel-${Date.now()}@e2e.local`,
      name: 'Cancel User',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: user.id,
      name: 'Keep This Game',
      play_days: [5],
    });

    await loginTestUser(page, {
      email: user.email,
      name: user.name,
      is_gm: true,
    });

    await page.goto('/settings/delete-account');

    // Wait for game decisions to load
    await expect(page.getByText('Keep This Game')).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Click "Back to Settings"
    await page.getByRole('link', { name: /back to settings/i }).click();

    await expect(page).toHaveURL('/settings', { timeout: TEST_TIMEOUTS.DEFAULT });

    // Game should still exist
    expect(await gameExistsInDb(game.id)).toBe(true);
    expect(await userExistsInDb(user.id)).toBe(true);
  });

  test('mixed GM and member games', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `del-mixed-gm-${Date.now()}@e2e.local`,
      name: 'Mixed GM',
      is_gm: true,
    });

    const otherGm = await createTestUser(request, {
      email: `del-mixed-other-${Date.now()}@e2e.local`,
      name: 'Other GM',
      is_gm: true,
    });

    const player = await createTestUser(request, {
      email: `del-mixed-player-${Date.now()}@e2e.local`,
      name: 'Mixed Player',
      is_gm: true,
    });

    // Game A: solo (only GM)
    const gameA = await createTestGame({
      gm_id: gm.id,
      name: 'Solo Game A',
      play_days: [5],
    });

    // Game B: has members
    const gameB = await createTestGame({
      gm_id: gm.id,
      name: 'Multi Game B',
      play_days: [6],
    });
    await addPlayerToGame(gameB.id, player.id);

    // Game C: owned by someone else, GM is just a member
    const gameC = await createTestGame({
      gm_id: otherGm.id,
      name: 'Other Game C',
      play_days: [5],
    });
    await addPlayerToGame(gameC.id, gm.id);

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto('/settings/delete-account');

    // Should show both GM games
    await expect(page.getByText('Solo Game A')).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await expect(page.getByText('Multi Game B')).toBeVisible();

    // Solo game should show as auto-delete
    await expect(page.getByText(/only you.*will be deleted/i)).toBeVisible();

    // Should note removal from other games
    await expect(page.getByText(/removed from.*other game/i)).toBeVisible();

    // Choose to transfer Game B (select by value = player's user ID)
    const select = page.locator('select');
    await select.selectOption(player.id);

    // Continue to confirmation
    await page.getByRole('button', { name: /continue/i }).click();

    // Summary should show both deleted and transferred
    await expect(page.getByText(/games that will be deleted/i)).toBeVisible();
    await expect(page.getByText('Solo Game A')).toBeVisible();
    await expect(page.getByText(/games that will be transferred/i)).toBeVisible();
    await expect(page.getByText(/Mixed Player/)).toBeVisible();
    await expect(page.getByText(/removed from.*other game/i)).toBeVisible();

    // Confirm
    await page.getByPlaceholder('your@email.com').fill(gm.email);
    await page.getByRole('button', { name: /delete my account/i }).click();

    await expect(page).toHaveURL('/', { timeout: TEST_TIMEOUTS.LONG });

    // Solo game A should be deleted
    expect(await gameExistsInDb(gameA.id)).toBe(false);

    // Multi game B should be transferred
    expect(await getGameGmId(gameB.id)).toBe(player.id);

    // Other game C should still exist, GM's membership gone
    expect(await gameExistsInDb(gameC.id)).toBe(true);
    expect(await membershipRowsForUser(gm.id)).toBe(0);

    // User should be gone
    expect(await userExistsInDb(gm.id)).toBe(false);
  });
});
