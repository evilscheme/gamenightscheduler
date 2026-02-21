import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import {
  createTestGame,
  addPlayerToGame,
  setAvailability,
  createTestSession,
  getPlayDates,
  getPastPlayDates,
} from '../../helpers/seed';
import {
  userExistsInDb,
  authUserExistsInDb,
  gameExistsInDb,
  gameMembershipsForUser,
  availabilityRowsForUser,
  getGameGmId,
  membershipExistsInGame,
  sessionsInGame,
  sessionConfirmedByForGame,
  availabilityRowsInGame,
} from '../../helpers/db-assertions';
import { TEST_TIMEOUTS } from '../../constants';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function navigateToDeleteAccount(page: import('@playwright/test').Page) {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({
    timeout: TEST_TIMEOUTS.LONG,
  });
  await page.getByRole('link', { name: /delete account/i }).click();
  await expect(page).toHaveURL(/\/settings\/delete-account/, {
    timeout: TEST_TIMEOUTS.DEFAULT,
  });
}

async function confirmDeletion(page: import('@playwright/test').Page) {
  await page.getByLabel(/type delete to confirm/i).fill('DELETE');
  // Use force:true to bypass Playwright's pointer-event hit-test; the button
  // is actionable (enabled + visible) but a layout shift from a top-of-page
  // element can cause <html> to intercept coordinates during the click attempt.
  await page.getByRole('button', { name: /permanently delete my account/i }).click({ force: true });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Delete Account — settings entry point', () => {
  test('settings page shows Danger Zone with Delete Account link', async ({ page }) => {
    await loginTestUser(page, {
      email: `danger-zone-${Date.now()}@e2e.local`,
      name: 'Danger Zone User',
      is_gm: false,
    });

    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Use heading role to avoid strict-mode conflict with username in navbar
    await expect(page.getByRole('heading', { name: 'Danger Zone' })).toBeVisible();
    await expect(page.getByRole('link', { name: /delete account/i })).toBeVisible();
  });

  test('delete account page requires authentication', async ({ page }) => {
    await page.goto('/settings/delete-account');
    await expect(page).toHaveURL(/\/login/, { timeout: TEST_TIMEOUTS.LONG });
  });
});

test.describe('Delete Account — user with no owned games', () => {
  test('skips game decision step and goes straight to confirmation', async ({ page }) => {
    const user = await loginTestUser(page, {
      email: `no-games-delete-${Date.now()}@e2e.local`,
      name: 'No Games User',
      is_gm: false,
    });

    await navigateToDeleteAccount(page);

    // Should land directly on the confirmation step (no decision step)
    await expect(page.getByText(/type.*DELETE.*to confirm/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });
    await expect(page.getByRole('button', { name: /permanently delete my account/i })).toBeVisible();

    // Confirm button is disabled until text is entered
    await expect(
      page.getByRole('button', { name: /permanently delete my account/i })
    ).toBeDisabled();

    await confirmDeletion(page);

    // useAuthRedirect redirects to /login once the session is cleared
    await expect(page).toHaveURL(/\/login/, { timeout: TEST_TIMEOUTS.LONG });

    // DB: user is fully gone
    expect(await userExistsInDb(user.id)).toBe(false);
    expect(await authUserExistsInDb(user.id)).toBe(false);
  });

  test('confirmation word must match exactly — wrong text keeps button disabled', async ({
    page,
  }) => {
    await loginTestUser(page, {
      email: `confirm-word-${Date.now()}@e2e.local`,
      name: 'Confirm Word User',
      is_gm: false,
    });

    await navigateToDeleteAccount(page);

    const confirmBtn = page.getByRole('button', { name: /permanently delete my account/i });

    // Wrong casing
    await page.getByLabel(/type delete to confirm/i).fill('delete');
    await expect(confirmBtn).toBeDisabled();

    // Partial
    await page.getByLabel(/type delete to confirm/i).fill('DELET');
    await expect(confirmBtn).toBeDisabled();

    // Correct
    await page.getByLabel(/type delete to confirm/i).fill('DELETE');
    await expect(confirmBtn).toBeEnabled();
  });
});

test.describe('Delete Account — solo owned games', () => {
  test('user with only-solo games: all games and data cascade-deleted', async ({ page }) => {
    const gm = await loginTestUser(page, {
      email: `solo-gm-delete-${Date.now()}@e2e.local`,
      name: 'Solo GM',
      is_gm: true,
    });

    // Create two games with no other members
    const game1 = await createTestGame({ gm_id: gm.id, name: 'Solo Game 1' });
    const game2 = await createTestGame({ gm_id: gm.id, name: 'Solo Game 2' });

    // Add availability entries for the GM in their own games
    const dates = getPlayDates([5, 6], 2);
    await setAvailability(gm.id, game1.id, [{ date: dates[0], status: 'available' }]);
    await setAvailability(gm.id, game2.id, [{ date: dates[1], status: 'maybe' }]);

    // Create a session in game1
    const pastDates = getPastPlayDates([5, 6], 2);
    await createTestSession({ game_id: game1.id, date: pastDates[0], confirmed_by: gm.id });

    await navigateToDeleteAccount(page);

    // Should go straight to confirmation (no multi-member games)
    await expect(page.getByText(/type.*DELETE.*to confirm/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    await confirmDeletion(page);
    await expect(page).toHaveURL(/\/login/, { timeout: TEST_TIMEOUTS.LONG });

    // DB: user profile and auth both gone
    expect(await userExistsInDb(gm.id)).toBe(false);
    expect(await authUserExistsInDb(gm.id)).toBe(false);

    // DB: both games are gone (cascade from user deletion)
    expect(await gameExistsInDb(game1.id)).toBe(false);
    expect(await gameExistsInDb(game2.id)).toBe(false);

    // DB: no availability rows remain for this user
    expect(await availabilityRowsForUser(gm.id)).toBe(0);
  });
});

test.describe('Delete Account — multi-member games, choose delete', () => {
  // Use standalone `request` fixture for secondary users so page session stays as the GM
  test('shows game decision step and deletes game + all player data', async ({ page, request }) => {
    const gm = await loginTestUser(page, {
      email: `multi-delete-gm-${Date.now()}@e2e.local`,
      name: 'Multi Delete GM',
      is_gm: true,
    });

    const player = await createTestUser(request, {
      email: `multi-delete-player-${Date.now()}@e2e.local`,
      name: 'Multi Delete Player',
      is_gm: false,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Multi Member Game',
      play_days: [5, 6],
    });

    await addPlayerToGame(game.id, player.id);

    const dates = getPlayDates([5, 6], 2);
    await setAvailability(gm.id, game.id, [{ date: dates[0], status: 'available' }]);
    await setAvailability(player.id, game.id, [
      { date: dates[0], status: 'available' },
      { date: dates[1], status: 'maybe' },
    ]);

    const pastDates = getPastPlayDates([5, 6], 2);
    await createTestSession({ game_id: game.id, date: pastDates[0], confirmed_by: gm.id });

    await navigateToDeleteAccount(page);

    // Should show the decision step
    await expect(page.getByText('Games with other players')).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });
    await expect(page.getByText('Multi Member Game')).toBeVisible();

    // Choose to delete the game
    await page.getByLabel(/delete this game and remove all player data/i).click();

    // Continue to confirmation
    await page.getByRole('button', { name: /continue/i }).click();

    // Should show confirmation step with deletion summary
    await expect(page.getByText(/type.*DELETE.*to confirm/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });
    await expect(page.getByText(/1 game will be permanently deleted/i)).toBeVisible();
    await expect(page.getByText('Multi Member Game')).toBeVisible();

    await confirmDeletion(page);
    await expect(page).toHaveURL(/\/login/, { timeout: TEST_TIMEOUTS.LONG });

    // DB: GM is gone
    expect(await userExistsInDb(gm.id)).toBe(false);
    expect(await authUserExistsInDb(gm.id)).toBe(false);

    // DB: game is gone (and therefore all its data)
    expect(await gameExistsInDb(game.id)).toBe(false);

    // DB: player's availability in the deleted game is gone (cascaded)
    expect(await availabilityRowsInGame(game.id, player.id)).toBe(0);

    // DB: player's membership is gone (cascaded)
    expect(await membershipExistsInGame(game.id, player.id)).toBe(false);
  });

  test('cannot proceed past step 1 without decisions for all multi-member games', async ({
    page,
    request,
  }) => {
    const gm = await loginTestUser(page, {
      email: `no-decision-gm-${Date.now()}@e2e.local`,
      name: 'No Decision GM',
      is_gm: true,
    });

    const player = await createTestUser(request, {
      email: `no-decision-player-${Date.now()}@e2e.local`,
      name: 'No Decision Player',
      is_gm: false,
    });

    const game = await createTestGame({ gm_id: gm.id, name: 'Undecided Game' });
    await addPlayerToGame(game.id, player.id);

    await navigateToDeleteAccount(page);

    await expect(page.getByText('Games with other players')).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Continue button is disabled when no decision has been made
    await expect(page.getByRole('button', { name: /continue/i })).toBeDisabled();
  });
});

test.describe('Delete Account — multi-member games, choose transfer', () => {
  test('transfers game ownership and preserves all other players and sessions', async ({
    page,
    request,
  }) => {
    const gm = await loginTestUser(page, {
      email: `transfer-gm-${Date.now()}@e2e.local`,
      name: 'Transfer GM',
      is_gm: true,
    });

    const player = await createTestUser(request, {
      email: `transfer-player-${Date.now()}@e2e.local`,
      name: 'Transfer Player',
      is_gm: false,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Transfer Game',
      play_days: [5, 6],
    });

    await addPlayerToGame(game.id, player.id);

    const dates = getPlayDates([5, 6], 2);
    await setAvailability(player.id, game.id, [{ date: dates[0], status: 'available' }]);

    const pastDates = getPastPlayDates([5, 6], 2);
    await createTestSession({
      game_id: game.id,
      date: pastDates[0],
      confirmed_by: gm.id,
    });

    await navigateToDeleteAccount(page);

    await expect(page.getByText('Games with other players')).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Select "Transfer to another player"
    await page.getByRole('radio', { name: /transfer to another player/i }).click();

    // The player should appear in the transfer dropdown
    await expect(page.getByRole('combobox')).toBeVisible();

    // Continue to confirmation
    await page.getByRole('button', { name: /continue/i }).click();

    await expect(page.getByText(/type.*DELETE.*to confirm/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });
    await expect(page.getByText(/1 game will be transferred/i)).toBeVisible();
    await expect(page.getByText(/Transfer Game → Transfer Player/)).toBeVisible();

    await confirmDeletion(page);
    await expect(page).toHaveURL(/\/login/, { timeout: TEST_TIMEOUTS.LONG });

    // DB: GM is gone
    expect(await userExistsInDb(gm.id)).toBe(false);
    expect(await authUserExistsInDb(gm.id)).toBe(false);

    // DB: game still exists
    expect(await gameExistsInDb(game.id)).toBe(true);

    // DB: game GM is now the player
    expect(await getGameGmId(game.id)).toBe(player.id);

    // DB: player is no longer in game_memberships (they're now the GM)
    expect(await membershipExistsInGame(game.id, player.id)).toBe(false);

    // DB: player's availability in the game is preserved
    expect(await availabilityRowsInGame(game.id, player.id)).toBeGreaterThan(0);

    // DB: session still exists in the transferred game
    expect(await sessionsInGame(game.id)).toBe(1);

    // DB: session confirmed_by is NULL (old GM is deleted, ON DELETE SET NULL)
    expect(await sessionConfirmedByForGame(game.id)).toBeNull();
  });

  test('old GM availability in transferred game is cleaned up', async ({ page, request }) => {
    const gm = await loginTestUser(page, {
      email: `old-gm-avail-${Date.now()}@e2e.local`,
      name: 'Old GM Avail',
      is_gm: true,
    });

    const player = await createTestUser(request, {
      email: `old-gm-player-${Date.now()}@e2e.local`,
      name: 'New GM Player',
      is_gm: false,
    });

    const game = await createTestGame({ gm_id: gm.id, name: 'GM Avail Game', play_days: [5, 6] });
    await addPlayerToGame(game.id, player.id);

    const dates = getPlayDates([5, 6], 3);
    await setAvailability(gm.id, game.id, [
      { date: dates[0], status: 'available' },
      { date: dates[1], status: 'maybe' },
    ]);
    await setAvailability(player.id, game.id, [{ date: dates[0], status: 'available' }]);

    await navigateToDeleteAccount(page);

    await expect(page.getByText('Games with other players')).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    await page.getByRole('radio', { name: /transfer to another player/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();
    await confirmDeletion(page);

    await expect(page).toHaveURL(/\/login/, { timeout: TEST_TIMEOUTS.LONG });

    // DB: old GM's availability is gone (cascade from user deletion)
    expect(await availabilityRowsInGame(game.id, gm.id)).toBe(0);

    // DB: new GM's (player's) availability is preserved
    expect(await availabilityRowsInGame(game.id, player.id)).toBeGreaterThan(0);
  });
});

test.describe('Delete Account — player memberships in other games', () => {
  test('all memberships and availability in other games are deleted', async ({ page, request }) => {
    const otherGm = await createTestUser(request, {
      email: `other-gm-${Date.now()}@e2e.local`,
      name: 'Other GM',
      is_gm: true,
    });

    const userToDelete = await loginTestUser(page, {
      email: `player-delete-${Date.now()}@e2e.local`,
      name: 'Departing Player',
      is_gm: false,
    });

    // User is a player in two other games they don't own
    const game1 = await createTestGame({ gm_id: otherGm.id, name: "Other GM's Game 1" });
    const game2 = await createTestGame({ gm_id: otherGm.id, name: "Other GM's Game 2" });

    await addPlayerToGame(game1.id, userToDelete.id);
    await addPlayerToGame(game2.id, userToDelete.id);

    const dates = getPlayDates([5, 6], 2);
    await setAvailability(userToDelete.id, game1.id, [
      { date: dates[0], status: 'available' },
      { date: dates[1], status: 'unavailable' },
    ]);
    await setAvailability(userToDelete.id, game2.id, [{ date: dates[0], status: 'maybe' }]);

    await navigateToDeleteAccount(page);

    // No owned games, skip to confirmation
    await expect(page.getByText(/type.*DELETE.*to confirm/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Summary shows the specific games user will be removed from
    await expect(page.getByText(/removed from 2 games/i)).toBeVisible();
    await expect(page.getByText("Other GM's Game 1")).toBeVisible();
    await expect(page.getByText("Other GM's Game 2")).toBeVisible();

    await confirmDeletion(page);
    await expect(page).toHaveURL(/\/login/, { timeout: TEST_TIMEOUTS.LONG });

    // DB: user is gone
    expect(await userExistsInDb(userToDelete.id)).toBe(false);

    // DB: membership rows are gone
    expect(await membershipExistsInGame(game1.id, userToDelete.id)).toBe(false);
    expect(await membershipExistsInGame(game2.id, userToDelete.id)).toBe(false);

    // DB: total membership count is 0
    expect(await gameMembershipsForUser(userToDelete.id)).toBe(0);

    // DB: availability rows in both games are gone
    expect(await availabilityRowsInGame(game1.id, userToDelete.id)).toBe(0);
    expect(await availabilityRowsInGame(game2.id, userToDelete.id)).toBe(0);

    // DB: total availability count for this user is 0
    expect(await availabilityRowsForUser(userToDelete.id)).toBe(0);

    // DB: the other games themselves are unaffected
    expect(await gameExistsInDb(game1.id)).toBe(true);
    expect(await gameExistsInDb(game2.id)).toBe(true);
  });
});

test.describe('Delete Account — mixed GM and member games', () => {
  test('handles solo games, multi-member delete, multi-member transfer, and player memberships', async ({
    page,
    request,
  }) => {
    const ts = Date.now();
    const gm = await loginTestUser(page, {
      email: `mixed-gm-${ts}@e2e.local`,
      name: 'Mixed GM',
      is_gm: true,
    });

    const player1 = await createTestUser(request, {
      email: `mixed-player1-${ts}@e2e.local`,
      name: 'Mixed Player 1',
      is_gm: false,
    });

    const player2 = await createTestUser(request, {
      email: `mixed-player2-${ts}@e2e.local`,
      name: 'Mixed Player 2',
      is_gm: true,
    });

    // --- Solo game (no other members, auto-deleted) ---
    const soloGame = await createTestGame({ gm_id: gm.id, name: 'Solo Campaign' });
    const dates = getPlayDates([5, 6], 2);
    await setAvailability(gm.id, soloGame.id, [{ date: dates[0], status: 'available' }]);

    // --- Multi-member game to DELETE ---
    const deleteGame = await createTestGame({
      gm_id: gm.id,
      name: 'Doomed Campaign',
      play_days: [5, 6],
    });
    await addPlayerToGame(deleteGame.id, player1.id);
    await setAvailability(player1.id, deleteGame.id, [{ date: dates[0], status: 'available' }]);

    // --- Multi-member game to TRANSFER ---
    const transferGame = await createTestGame({
      gm_id: gm.id,
      name: 'Inherited Campaign',
      play_days: [5, 6],
    });
    await addPlayerToGame(transferGame.id, player2.id);
    await setAvailability(player2.id, transferGame.id, [{ date: dates[0], status: 'maybe' }]);
    const pastDates = getPastPlayDates([5, 6], 2);
    await createTestSession({
      game_id: transferGame.id,
      date: pastDates[0],
      confirmed_by: gm.id,
    });

    // --- Player membership in another user's game ---
    const otherGame = await createTestGame({ gm_id: player1.id, name: "Player1's Game" });
    await addPlayerToGame(otherGame.id, gm.id);
    await setAvailability(gm.id, otherGame.id, [{ date: dates[0], status: 'available' }]);

    // Navigate to delete account
    await navigateToDeleteAccount(page);

    // Should show decision step (multi-member games exist)
    await expect(page.getByText('Games with other players')).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Solo game should show in auto-delete section
    await expect(page.getByText('Solo Campaign')).toBeVisible();

    // Make decisions for multi-member games
    // First game: Delete — find the radio within the Doomed Campaign card
    const doomedCard = page.locator('[class*="border"]', { hasText: 'Doomed Campaign' });
    await doomedCard.getByLabel(/delete this game and remove all player data/i).click();

    // Second game: Transfer — find the radio within the Inherited Campaign card
    const inheritedCard = page.locator('[class*="border"]', { hasText: 'Inherited Campaign' });
    await inheritedCard.getByLabel(/transfer to another player/i).click();

    // Continue to confirmation
    await page.getByRole('button', { name: /continue/i }).click();

    // Confirmation step — verify explicit game lists
    await expect(page.getByText(/type.*DELETE.*to confirm/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // 2 games deleted (solo + doomed)
    await expect(page.getByText(/2 games will be permanently deleted/i)).toBeVisible();
    await expect(page.getByText('Solo Campaign')).toBeVisible();
    await expect(page.getByText('Doomed Campaign')).toBeVisible();

    // 1 game transferred
    await expect(page.getByText(/1 game will be transferred/i)).toBeVisible();
    await expect(page.getByText(/Inherited Campaign → Mixed Player 2/)).toBeVisible();

    // 1 player membership
    await expect(page.getByText(/removed from 1 game/i)).toBeVisible();
    await expect(page.getByText("Player1's Game")).toBeVisible();

    // Confirm deletion
    await confirmDeletion(page);
    await expect(page).toHaveURL(/\/login/, { timeout: TEST_TIMEOUTS.LONG });

    // --- DB assertions ---

    // GM is fully gone
    expect(await userExistsInDb(gm.id)).toBe(false);
    expect(await authUserExistsInDb(gm.id)).toBe(false);

    // Solo game: deleted
    expect(await gameExistsInDb(soloGame.id)).toBe(false);

    // Doomed game: deleted (all player data cascaded)
    expect(await gameExistsInDb(deleteGame.id)).toBe(false);
    expect(await availabilityRowsInGame(deleteGame.id, player1.id)).toBe(0);
    expect(await membershipExistsInGame(deleteGame.id, player1.id)).toBe(false);

    // Transferred game: preserved with new owner
    expect(await gameExistsInDb(transferGame.id)).toBe(true);
    expect(await getGameGmId(transferGame.id)).toBe(player2.id);
    expect(await membershipExistsInGame(transferGame.id, player2.id)).toBe(false); // now GM, not member
    expect(await availabilityRowsInGame(transferGame.id, player2.id)).toBeGreaterThan(0);
    expect(await sessionsInGame(transferGame.id)).toBe(1);
    expect(await sessionConfirmedByForGame(transferGame.id)).toBeNull(); // old GM deleted

    // Player membership: removed from other game
    expect(await membershipExistsInGame(otherGame.id, gm.id)).toBe(false);
    expect(await availabilityRowsInGame(otherGame.id, gm.id)).toBe(0);

    // Other game itself is unaffected
    expect(await gameExistsInDb(otherGame.id)).toBe(true);

    // No leftover data for the deleted user
    expect(await gameMembershipsForUser(gm.id)).toBe(0);
    expect(await availabilityRowsForUser(gm.id)).toBe(0);
  });
});

test.describe('Delete Account — cancel flows', () => {
  test('cancelling from decision step returns to settings', async ({ page, request }) => {
    const gm = await loginTestUser(page, {
      email: `cancel-decision-${Date.now()}@e2e.local`,
      name: 'Cancel Decision GM',
      is_gm: true,
    });

    const player = await createTestUser(request, {
      email: `cancel-player-${Date.now()}@e2e.local`,
      name: 'Cancel Player',
      is_gm: false,
    });

    const game = await createTestGame({ gm_id: gm.id, name: 'Cancel Game' });
    await addPlayerToGame(game.id, player.id);

    await navigateToDeleteAccount(page);

    await expect(page.getByText('Games with other players')).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Click Cancel
    await page.getByRole('link', { name: 'Cancel', exact: true }).click();

    await expect(page).toHaveURL(/\/settings$/, { timeout: TEST_TIMEOUTS.DEFAULT });

    // User still exists
    expect(await userExistsInDb(gm.id)).toBe(true);
  });

  test('cancelling from confirmation step returns to settings', async ({ page }) => {
    const user = await loginTestUser(page, {
      email: `cancel-confirm-${Date.now()}@e2e.local`,
      name: 'Cancel Confirm User',
      is_gm: false,
    });

    await navigateToDeleteAccount(page);

    await expect(page.getByText(/type.*DELETE.*to confirm/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    await page.getByRole('link', { name: 'Cancel', exact: true }).click();

    await expect(page).toHaveURL(/\/settings$/, { timeout: TEST_TIMEOUTS.DEFAULT });

    expect(await userExistsInDb(user.id)).toBe(true);
  });
});
