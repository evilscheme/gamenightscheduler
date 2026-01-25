import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import {
  createTestGame,
  addPlayerToGame,
  setAvailability,
  createTestSession,
  getPlayDates,
} from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Multi-User Session Visibility', () => {
  test('all players see confirmed session after GM confirms', async ({ browser, request }) => {
    // Create GM and player
    const gm = await createTestUser(request, {
      email: `gm-visibility-${Date.now()}@e2e.local`,
      name: 'Visibility GM',
      is_gm: true,
    });

    const player = await createTestUser(request, {
      email: `player-visibility-${Date.now()}@e2e.local`,
      name: 'Visibility Player',
      is_gm: false,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Visibility Campaign',
      play_days: [5, 6],
    });

    await addPlayerToGame(game.id, player.id);

    const playDates = getPlayDates([5, 6], 4);
    await setAvailability(gm.id, game.id, [{ date: playDates[0], is_available: true }]);
    await setAvailability(player.id, game.id, [{ date: playDates[0], is_available: true }]);

    // Create two browser contexts
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // Login both users
      await loginTestUser(gmPage, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await loginTestUser(playerPage, {
        email: player.email,
        name: player.name,
        is_gm: false,
      });

      // GM confirms a session
      await gmPage.goto(`/games/${game.id}`);
      await expect(gmPage.getByRole('button', { name: /schedule/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });
      await gmPage.getByRole('button', { name: /schedule/i }).click();
      await expect(gmPage.getByText(/date suggestions/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      await gmPage.getByRole('button', { name: /^confirm$/i }).first().click();
      await expect(gmPage.getByRole('heading', { name: /schedule session/i })).toBeVisible();
      await gmPage.getByRole('button', { name: /confirm session/i }).click();

      // GM sees confirmed session
      await expect(gmPage.getByText(/upcoming sessions/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Player navigates and should also see the confirmed session
      await playerPage.goto(`/games/${game.id}`);
      await expect(playerPage.getByRole('button', { name: /schedule/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });
      await playerPage.getByRole('button', { name: /schedule/i }).click();

      await expect(playerPage.getByText(/upcoming sessions/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Player should see the dice emoji for confirmed session
      await expect(playerPage.locator('text=🎲').first()).toBeVisible();
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('new player joining sees existing confirmed sessions', async ({ page, request }) => {
    // Create GM and create a confirmed session before player joins
    const gm = await createTestUser(request, {
      email: `gm-newplayer-${Date.now()}@e2e.local`,
      name: 'New Player GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'New Player Campaign',
      play_days: [5, 6],
    });

    // Create confirmed session before player joins
    const playDates = getPlayDates([5, 6], 4);
    await createTestSession({
      game_id: game.id,
      date: playDates[0],
      confirmed_by: gm.id,
      start_time: '18:00',
      end_time: '22:00',
    });

    // Now create player and add to game
    const player = await createTestUser(request, {
      email: `player-newplayer-${Date.now()}@e2e.local`,
      name: 'New Player',
      is_gm: false,
    });

    await addPlayerToGame(game.id, player.id);

    // Login as the new player
    await loginTestUser(page, {
      email: player.email,
      name: player.name,
      is_gm: false,
    });

    // Navigate to the game
    await page.goto(`/games/${game.id}`);
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /schedule/i }).click();

    // New player should see the existing confirmed session
    await expect(page.getByText(/upcoming sessions/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Should see session times
    await expect(page.getByText(/6:00 PM/)).toBeVisible();
    await expect(page.getByText(/10:00 PM/)).toBeVisible();
  });

  test('member list updates when new player joins', async ({ browser, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-memberlist-${Date.now()}@e2e.local`,
      name: 'Member List GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Member List Campaign',
      play_days: [5, 6],
    });

    // Create two browser contexts
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // Login GM
      await loginTestUser(gmPage, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      // GM views game - should only see themselves
      await gmPage.goto(`/games/${game.id}`);
      // Wait for game page to load
      await expect(gmPage.getByRole('heading', { name: game.name })).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });
      // GM name should appear (in header or member list)
      await expect(gmPage.getByText(gm.name).first()).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Create and add new player using the standalone request context
      // (this is just for data creation, not for logging in)
      const player = await createTestUser(request, {
        email: `player-memberlist-${Date.now()}@e2e.local`,
        name: 'New Member Player',
        is_gm: false,
      });

      await addPlayerToGame(game.id, player.id);

      // Login player
      await loginTestUser(playerPage, {
        email: player.email,
        name: player.name,
        is_gm: false,
      });

      // Player can see the game
      await playerPage.goto(`/games/${game.id}`);
      await expect(playerPage.getByText(game.name)).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Reload the page to fetch fresh data (cookies are preserved on reload)
      await gmPage.reload({ waitUntil: 'networkidle' });

      // Wait for page to fully load after reload
      await expect(gmPage.getByRole('heading', { name: game.name })).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });
      // New player should appear in member list
      await expect(gmPage.getByText(player.name)).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Both GM and player should be listed
      await expect(gmPage.getByText(gm.name).first()).toBeVisible();
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });
});
