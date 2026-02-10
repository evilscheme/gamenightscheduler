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

test.describe('Confirmed Day Availability', () => {
  test('confirmed day shows player availability status', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-conf-avail-${Date.now()}@e2e.local`,
      name: 'Conf Avail GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Conf Avail Campaign',
      play_days: [5, 6],
    });

    const playDates = getPlayDates([5, 6], 4);
    const confirmedDate = playDates[0];

    // Set GM as available on the date, then confirm a session
    await setAvailability(gm.id, game.id, [{ date: confirmedDate, status: 'available' }]);
    await createTestSession({
      game_id: game.id,
      date: confirmedDate,
      confirmed_by: gm.id,
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Navigate to availability tab
    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible();

    // Find the confirmed date cell
    const dateButton = page.locator(`button[data-date="${confirmedDate}"]`);
    await expect(dateButton).toBeVisible();

    // Should be marked as scheduled with availability shown
    await expect(dateButton).toHaveAttribute('data-status', 'scheduled');
    await expect(dateButton).toHaveAttribute('data-availability', 'available');
  });

  test('player can cycle availability on confirmed day', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-conf-cycle-${Date.now()}@e2e.local`,
      name: 'Conf Cycle GM',
      is_gm: true,
    });

    const player = await createTestUser(request, {
      email: `player-conf-cycle-${Date.now()}@e2e.local`,
      name: 'Conf Cycle Player',
      is_gm: false,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Conf Cycle Campaign',
      play_days: [5, 6],
    });

    await addPlayerToGame(game.id, player.id);

    const playDates = getPlayDates([5, 6], 4);
    const confirmedDate = playDates[0];

    // Set availability and confirm a session
    await setAvailability(gm.id, game.id, [{ date: confirmedDate, status: 'available' }]);
    await setAvailability(player.id, game.id, [{ date: confirmedDate, status: 'available' }]);
    await createTestSession({
      game_id: game.id,
      date: confirmedDate,
      confirmed_by: gm.id,
    });

    // Login as player
    await loginTestUser(page, {
      email: player.email,
      name: player.name,
      is_gm: false,
    });

    await page.goto(`/games/${game.id}`);

    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible();

    const dateButton = page.locator(`button[data-date="${confirmedDate}"]`);
    await expect(dateButton).toBeVisible();

    // Starts as available
    await expect(dateButton).toHaveAttribute('data-status', 'scheduled');
    await expect(dateButton).toHaveAttribute('data-availability', 'available');

    // Click to cycle: available -> unavailable
    await dateButton.click();
    await expect(dateButton).toHaveAttribute('data-availability', 'unavailable');

    // Still shows as scheduled
    await expect(dateButton).toHaveAttribute('data-status', 'scheduled');

    // Click again: unavailable -> maybe
    await dateButton.click();
    await expect(dateButton).toHaveAttribute('data-availability', 'maybe');

    // Click again: maybe -> available
    await dateButton.click();
    await expect(dateButton).toHaveAttribute('data-availability', 'available');
  });

  test('unset availability on confirmed day shows unset state', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-conf-unset-${Date.now()}@e2e.local`,
      name: 'Conf Unset GM',
      is_gm: true,
    });

    const player = await createTestUser(request, {
      email: `player-conf-unset-${Date.now()}@e2e.local`,
      name: 'Conf Unset Player',
      is_gm: false,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Conf Unset Campaign',
      play_days: [5, 6],
    });

    await addPlayerToGame(game.id, player.id);

    const playDates = getPlayDates([5, 6], 4);
    const confirmedDate = playDates[0];

    // Only GM sets availability; player has no availability set
    await setAvailability(gm.id, game.id, [{ date: confirmedDate, status: 'available' }]);
    await createTestSession({
      game_id: game.id,
      date: confirmedDate,
      confirmed_by: gm.id,
    });

    // Login as player (who hasn't set availability)
    await loginTestUser(page, {
      email: player.email,
      name: player.name,
      is_gm: false,
    });

    await page.goto(`/games/${game.id}`);

    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible();

    const dateButton = page.locator(`button[data-date="${confirmedDate}"]`);
    await expect(dateButton).toBeVisible();

    // Should show scheduled with unset availability
    await expect(dateButton).toHaveAttribute('data-status', 'scheduled');
    await expect(dateButton).toHaveAttribute('data-availability', 'unset');

    // Click to set availability: unset -> available
    await dateButton.click();
    await expect(dateButton).toHaveAttribute('data-availability', 'available');
  });

  test('tooltip shows both schedule and availability info', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-conf-tooltip-${Date.now()}@e2e.local`,
      name: 'Conf Tooltip GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Conf Tooltip Campaign',
      play_days: [5, 6],
    });

    const playDates = getPlayDates([5, 6], 4);
    const confirmedDate = playDates[0];

    await setAvailability(gm.id, game.id, [{ date: confirmedDate, status: 'maybe' }]);
    await createTestSession({
      game_id: game.id,
      date: confirmedDate,
      confirmed_by: gm.id,
      start_time: '19:00',
      end_time: '23:00',
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible();

    const dateButton = page.locator(`button[data-date="${confirmedDate}"]`);
    await expect(dateButton).toBeVisible();

    // Check the title attribute contains both scheduled info and availability status
    const title = await dateButton.getAttribute('title');
    expect(title).toContain('Scheduled');
    expect(title).toContain('7pm');
    expect(title).toContain('11pm');
    expect(title).toContain('Your status: Maybe');
  });
});
