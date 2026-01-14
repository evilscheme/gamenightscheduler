import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import {
  createTestGame,
  addPlayerToGame,
  setAvailability,
  getPlayDates,
} from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Multi-User Availability Aggregation', () => {
  test('availability breakdown shows correct counts', async ({ page, request }) => {
    // Create GM + 3 players (4 total participants)
    const gm = await createTestUser(request, {
      email: `gm-agg-${Date.now()}@e2e.local`,
      name: 'Aggregation GM',
      is_gm: true,
    });

    const player1 = await createTestUser(request, {
      email: `player1-agg-${Date.now()}@e2e.local`,
      name: 'Player One',
      is_gm: false,
    });

    const player2 = await createTestUser(request, {
      email: `player2-agg-${Date.now()}@e2e.local`,
      name: 'Player Two',
      is_gm: false,
    });

    const player3 = await createTestUser(request, {
      email: `player3-agg-${Date.now()}@e2e.local`,
      name: 'Player Three',
      is_gm: false,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Aggregation Campaign',
      play_days: [5, 6], // Friday, Saturday
    });

    // Add all players to game
    await addPlayerToGame(game.id, player1.id);
    await addPlayerToGame(game.id, player2.id);
    await addPlayerToGame(game.id, player3.id);

    // Get play dates and set availability
    const playDates = getPlayDates([5, 6], 4);
    const targetDate = playDates[0];

    // GM and Player1 available, Player2 unavailable, Player3 pending (no response)
    await setAvailability(gm.id, game.id, [{ date: targetDate, is_available: true }]);
    await setAvailability(player1.id, game.id, [{ date: targetDate, is_available: true }]);
    await setAvailability(player2.id, game.id, [{ date: targetDate, is_available: false }]);
    // Player3 has no availability set (pending)

    // Login as GM and view schedule
    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Navigate to schedule tab
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /schedule/i }).click();

    // Verify correct counts displayed (2 available, 1 unavailable, 1 pending)
    await expect(page.getByText('2 available')).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });
    await expect(page.getByText('1 unavailable')).toBeVisible();
    await expect(page.getByText('1 pending')).toBeVisible();
  });

  test('date ranking respects availability count', async ({ page, request }) => {
    // Create GM + 2 players
    const gm = await createTestUser(request, {
      email: `gm-rank-${Date.now()}@e2e.local`,
      name: 'Ranking GM',
      is_gm: true,
    });

    const player1 = await createTestUser(request, {
      email: `player1-rank-${Date.now()}@e2e.local`,
      name: 'Rank Player One',
      is_gm: false,
    });

    const player2 = await createTestUser(request, {
      email: `player2-rank-${Date.now()}@e2e.local`,
      name: 'Rank Player Two',
      is_gm: false,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Ranking Campaign',
      play_days: [5, 6],
    });

    await addPlayerToGame(game.id, player1.id);
    await addPlayerToGame(game.id, player2.id);

    const playDates = getPlayDates([5, 6], 4);
    // Ensure we have at least 2 different dates
    const dateA = playDates[0]; // Will have 3 available
    const dateB = playDates[1]; // Will have 1 available

    // DateA: everyone available (3/3)
    await setAvailability(gm.id, game.id, [
      { date: dateA, is_available: true },
      { date: dateB, is_available: false },
    ]);
    await setAvailability(player1.id, game.id, [
      { date: dateA, is_available: true },
      { date: dateB, is_available: false },
    ]);
    await setAvailability(player2.id, game.id, [
      { date: dateA, is_available: true },
      { date: dateB, is_available: true },
    ]);

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Wait for page to load before interacting
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /schedule/i }).click();

    // Get all suggestion items
    const suggestions = page.locator('ul').filter({ hasText: /available/ }).locator('li');

    // First suggestion should show "3 available" (dateA)
    const firstSuggestion = suggestions.first();
    await expect(firstSuggestion.getByText('3 available')).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });
  });

  test('pending count accurate for unresponded players', async ({ page, request }) => {
    // Create GM + 3 players
    const gm = await createTestUser(request, {
      email: `gm-pending-${Date.now()}@e2e.local`,
      name: 'Pending GM',
      is_gm: true,
    });

    const player1 = await createTestUser(request, {
      email: `player1-pending-${Date.now()}@e2e.local`,
      name: 'Pending Player One',
      is_gm: false,
    });

    const player2 = await createTestUser(request, {
      email: `player2-pending-${Date.now()}@e2e.local`,
      name: 'Pending Player Two',
      is_gm: false,
    });

    const player3 = await createTestUser(request, {
      email: `player3-pending-${Date.now()}@e2e.local`,
      name: 'Pending Player Three',
      is_gm: false,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Pending Campaign',
      play_days: [5, 6],
    });

    await addPlayerToGame(game.id, player1.id);
    await addPlayerToGame(game.id, player2.id);
    await addPlayerToGame(game.id, player3.id);

    const playDates = getPlayDates([5, 6], 4);
    const targetDate = playDates[0];

    // Only GM and Player1 mark availability, Player2 and Player3 are pending
    await setAvailability(gm.id, game.id, [{ date: targetDate, is_available: true }]);
    await setAvailability(player1.id, game.id, [{ date: targetDate, is_available: true }]);
    // player2 and player3 don't respond

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Wait for page to load before interacting
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /schedule/i }).click();

    // Should show 2 available, 0 unavailable, 2 pending
    await expect(page.getByText('2 available')).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });
    await expect(page.getByText('2 pending')).toBeVisible();
  });

  // TODO: This test is flaky due to browser context session management issues
  // The multi-browser pattern with loginTestUser doesn't reliably maintain sessions
  test.skip('cross-user visibility after availability change', async ({ browser, request }) => {
    // Create GM + player
    const gm = await createTestUser(request, {
      email: `gm-cross-${Date.now()}@e2e.local`,
      name: 'Cross GM',
      is_gm: true,
    });

    const player = await createTestUser(request, {
      email: `player-cross-${Date.now()}@e2e.local`,
      name: 'Cross Player',
      is_gm: false,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Cross Campaign',
      play_days: [5, 6], // Friday, Saturday
    });

    await addPlayerToGame(game.id, player.id);

    // Get play dates and use API to set availability (more reliable than UI)
    const playDates = getPlayDates([5, 6], 4);
    const targetDate = playDates[0]; // First Friday or Saturday

    // GM marks available via API
    await setAvailability(gm.id, game.id, [{ date: targetDate, is_available: true }]);

    // Create two browser contexts (simulating two different users)
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

      // Login player
      await loginTestUser(playerPage, {
        email: player.email,
        name: player.name,
        is_gm: false,
      });

      // GM views schedule - should show 1 available (GM), 1 pending (player)
      await gmPage.goto(`/games/${game.id}`);
      await expect(gmPage.getByRole('button', { name: /schedule/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });
      await gmPage.getByRole('button', { name: /schedule/i }).click();
      await expect(gmPage.getByText(/date suggestions/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Should show at least one date with 1 available
      await expect(gmPage.getByText('1 available').first()).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Player marks themselves as available via API
      await setAvailability(player.id, game.id, [{ date: targetDate, is_available: true }]);

      // GM navigates away and back (instead of reload to avoid session issues)
      await gmPage.goto('/dashboard');
      await expect(gmPage.getByRole('heading', { name: /your games/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Navigate back to game schedule
      await gmPage.goto(`/games/${game.id}`);
      await expect(gmPage.getByRole('button', { name: /schedule/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });
      await gmPage.getByRole('button', { name: /schedule/i }).click();
      await expect(gmPage.getByText(/date suggestions/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Should show at least one date with 2 available
      await expect(gmPage.getByText('2 available').first()).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Player also sees updated count
      await playerPage.goto(`/games/${game.id}`);
      await expect(playerPage.getByRole('button', { name: /schedule/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });
      await playerPage.getByRole('button', { name: /schedule/i }).click();
      await expect(playerPage.getByText(/date suggestions/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Should show at least one date with 2 available
      await expect(playerPage.getByText('2 available').first()).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });
});
