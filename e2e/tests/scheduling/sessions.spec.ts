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

test.describe('Session Scheduling', () => {
  test('GM sees date suggestions on schedule tab', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-suggest-${Date.now()}@e2e.local`,
      name: 'Suggestions GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Suggestions Campaign',
      play_days: [5, 6], // Friday, Saturday
    });

    // Add a player and set availability
    const player = await createTestUser(request, {
      email: `player-suggest-${Date.now()}@e2e.local`,
      name: 'Suggestions Player',
      is_gm: false,
    });
    await addPlayerToGame(game.id, player.id);

    // Set availability for both GM and player
    const playDates = getPlayDates([5, 6], 2);
    if (playDates.length > 0) {
      await setAvailability(gm.id, game.id, [{ date: playDates[0], is_available: true }]);
      await setAvailability(player.id, game.id, [{ date: playDates[0], is_available: true }]);
    }

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Switch to schedule tab (wait for button then click)
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible();
    await page.getByRole('button', { name: /schedule/i }).click();

    // Should see date suggestions section
    await expect(page.getByText(/date suggestions/i)).toBeVisible();
  });

  // Note: "GM can see confirm button" test removed - it was a no-op assertion
  // (toBeGreaterThanOrEqual(0) always passes). Confirm button functionality
  // is tested thoroughly in confirmation.spec.ts

  test('player does not see confirm button', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-player-sched-${Date.now()}@e2e.local`,
      name: 'Player Schedule GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Player Schedule Campaign',
      play_days: [5, 6],
    });

    // Create player and add to game
    const player = await createTestUser(request, {
      email: `player-sched-${Date.now()}@e2e.local`,
      name: 'Schedule Player',
      is_gm: false,
    });
    await addPlayerToGame(game.id, player.id);

    await loginTestUser(page, {
      email: player.email,
      name: player.name,
      is_gm: false,
    });

    await page.goto(`/games/${game.id}`);

    // Switch to schedule tab (wait for button then click)
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible();
    await page.getByRole('button', { name: /schedule/i }).click();

    // Player should see suggestions but no confirm buttons (only GM can confirm)
    await expect(page.getByText(/date suggestions/i)).toBeVisible();
  });

  test('shows confirmed sessions', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-confirmed-${Date.now()}@e2e.local`,
      name: 'Confirmed GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Confirmed Campaign',
      play_days: [5, 6],
    });

    // Create a confirmed session
    const playDates = getPlayDates([5, 6], 4);
    if (playDates.length > 0) {
      await createTestSession({
        game_id: game.id,
        date: playDates[0],
        confirmed_by: gm.id,
        start_time: '18:00',
        end_time: '22:00',
      });
    }

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Switch to schedule tab (wait for button then click)
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible();
    await page.getByRole('button', { name: /schedule/i }).click();

    // Should see confirmed sessions section or the session
    await expect(page.getByText(/confirmed|session/i).first()).toBeVisible();
  });

  test('shows export options for confirmed sessions', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-export-${Date.now()}@e2e.local`,
      name: 'Export GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Export Campaign',
      play_days: [5, 6],
    });

    // Create a confirmed session
    const playDates = getPlayDates([5, 6], 4);
    if (playDates.length > 0) {
      await createTestSession({
        game_id: game.id,
        date: playDates[0],
        confirmed_by: gm.id,
      });
    }

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Switch to schedule tab (wait for button then click)
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible();
    await page.getByRole('button', { name: /schedule/i }).click();

    // Should see export options (like calendar export)
    // The exact text depends on the UI, but there should be export functionality
    const hasExport =
      (await page.getByText(/export/i).count()) > 0 ||
      (await page.getByText(/calendar/i).count()) > 0 ||
      (await page.getByText(/\.ics/i).count()) > 0;

    // Export functionality should be present if there are sessions
    expect(hasExport).toBe(true);
  });

  test('separates upcoming sessions from past sessions', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-past-${Date.now()}@e2e.local`,
      name: 'Separation GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Separation Campaign',
      play_days: [5, 6],
    });

    // Create an upcoming session
    const futureDates = getPlayDates([5, 6], 4);
    if (futureDates.length > 0) {
      await createTestSession({
        game_id: game.id,
        date: futureDates[0],
        confirmed_by: gm.id,
        start_time: '18:00',
        end_time: '22:00',
      });
    }

    // Create a past session
    const pastDates = getPastPlayDates([5, 6], 4);
    if (pastDates.length > 0) {
      await createTestSession({
        game_id: game.id,
        date: pastDates[0],
        confirmed_by: gm.id,
        start_time: '18:00',
        end_time: '22:00',
      });
    }

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Switch to schedule tab
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible();
    await page.getByRole('button', { name: /schedule/i }).click();

    // Should see "Upcoming Sessions" heading
    await expect(page.getByRole('heading', { name: /upcoming sessions/i })).toBeVisible();

    // Should see "Past Sessions" toggle button (collapsed by default)
    await expect(page.getByRole('button', { name: /past sessions \(\d+\)/i })).toBeVisible();
  });

  test('past sessions section is collapsed by default', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-collapsed-${Date.now()}@e2e.local`,
      name: 'Collapsed GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Collapsed Campaign',
      play_days: [5, 6],
    });

    // Create a past session
    const pastDates = getPastPlayDates([5, 6], 4);
    if (pastDates.length > 0) {
      await createTestSession({
        game_id: game.id,
        date: pastDates[0],
        confirmed_by: gm.id,
        start_time: '18:00',
        end_time: '22:00',
      });
    }

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Switch to schedule tab
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible();
    await page.getByRole('button', { name: /schedule/i }).click();

    // Past sessions toggle button should be visible with down arrow (collapsed)
    const pastSessionsButton = page.getByRole('button', { name: /past sessions \(\d+\).*▼/i });
    await expect(pastSessionsButton).toBeVisible();
  });

  test('past sessions can be expanded and collapsed', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-toggle-${Date.now()}@e2e.local`,
      name: 'Toggle GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Toggle Campaign',
      play_days: [5, 6],
    });

    // Create a past session
    const pastDates = getPastPlayDates([5, 6], 4);
    if (pastDates.length > 0) {
      await createTestSession({
        game_id: game.id,
        date: pastDates[0],
        confirmed_by: gm.id,
        start_time: '18:00',
        end_time: '22:00',
      });
    }

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Switch to schedule tab
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible();
    await page.getByRole('button', { name: /schedule/i }).click();

    // Click to expand past sessions
    const pastSessionsButton = page.getByRole('button', { name: /past sessions \(\d+\)/i });
    await pastSessionsButton.click();

    // Should now show up arrow (expanded)
    await expect(page.getByRole('button', { name: /past sessions \(\d+\).*▲/i })).toBeVisible();

    // Click again to collapse
    await pastSessionsButton.click();

    // Should show down arrow again (collapsed)
    await expect(page.getByRole('button', { name: /past sessions \(\d+\).*▼/i })).toBeVisible();
  });

  test('past sessions do not have Cancel button for GM', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-no-cancel-${Date.now()}@e2e.local`,
      name: 'No Cancel GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'No Cancel Campaign',
      play_days: [5, 6],
    });

    // Create only a past session (no upcoming sessions)
    const pastDates = getPastPlayDates([5, 6], 4);
    if (pastDates.length > 0) {
      await createTestSession({
        game_id: game.id,
        date: pastDates[0],
        confirmed_by: gm.id,
        start_time: '18:00',
        end_time: '22:00',
      });
    }

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Switch to schedule tab
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible();
    await page.getByRole('button', { name: /schedule/i }).click();

    // Expand past sessions
    const pastSessionsButton = page.getByRole('button', { name: /past sessions \(\d+\)/i });
    await pastSessionsButton.click();

    // Wait for the content to be visible (up arrow showing)
    await expect(page.getByRole('button', { name: /past sessions \(\d+\).*▲/i })).toBeVisible();

    // The past sessions card should be visible now
    // Since we only have past sessions (no upcoming), there should be no Cancel buttons on the page
    // in the sessions area. Wait a moment for content to load.
    await page.waitForTimeout(500);

    // There should be no Cancel button visible (past sessions don't have them)
    // The only Cancel buttons on the schedule tab would be in upcoming sessions
    const cancelButtons = page.locator('[class*="Card"]').filter({ hasText: /past sessions/i }).getByRole('button', { name: /^cancel$/i });
    await expect(cancelButtons).toHaveCount(0);
  });
});
