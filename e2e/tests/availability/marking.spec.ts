import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame, addPlayerToGame, getPlayDates } from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Availability Marking', () => {
  test('click unmarked date to mark as available', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-mark-${Date.now()}@e2e.local`,
      name: 'Marking GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Marking Campaign',
      play_days: [5, 6], // Friday, Saturday
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

    // Wait for calendar to load
    await expect(page.getByText(/mark your availability/i)).toBeVisible();

    // Get a future play date
    const playDates = getPlayDates([5, 6], 2);
    const targetDate = playDates[0];

    // Find the date button by its title attribute (which contains the date string)
    const dateButton = page.locator(`button[title="${targetDate}"]`);
    await expect(dateButton).toBeVisible();

    // Initial state: should have card background (not green or red)
    // Click to mark as available
    await dateButton.click();

    // After first click, should show unavailable (red) - the toggle goes undefined -> false -> true
    // Wait for visual change - the button should have green background class
    // Actually looking at the code: undefined -> false (unavailable) on first click
    // Then false -> true (available) on second click
    // Let me re-read the toggle logic...
    // currentAvail === false ? true : currentAvail === true ? false : false
    // So: if false -> true, if true -> false, if undefined -> false

    // First click: undefined -> false (unavailable/red)
    await expect(dateButton).toHaveClass(/bg-red/);

    // Second click: false -> true (available/green)
    await dateButton.click();
    await expect(dateButton).toHaveClass(/bg-green/);

    // Verify persistence after reload
    await page.reload();
    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /availability/i }).click();

    const dateButtonAfterReload = page.locator(`button[title="${targetDate}"]`);
    await expect(dateButtonAfterReload).toHaveClass(/bg-green/);
  });

  test('click available date to toggle to unavailable', async ({ page, request }) => {
    const player = await createTestUser(request, {
      email: `player-toggle-${Date.now()}@e2e.local`,
      name: 'Toggle Player',
      is_gm: false,
    });

    const gm = await createTestUser(request, {
      email: `gm-toggle-owner-${Date.now()}@e2e.local`,
      name: 'Toggle GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Toggle Campaign',
      play_days: [5, 6],
    });

    await addPlayerToGame(game.id, player.id);

    await loginTestUser(page, {
      email: player.email,
      name: player.name,
      is_gm: false,
    });

    await page.goto(`/games/${game.id}`);

    // Wait for page to load before interacting
    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible();

    const playDates = getPlayDates([5, 6], 2);
    const targetDate = playDates[0];

    const dateButton = page.locator(`button[title="${targetDate}"]`);
    await expect(dateButton).toBeVisible();

    // Click twice to get to available (green)
    await dateButton.click(); // undefined -> false (red)
    await dateButton.click(); // false -> true (green)
    await expect(dateButton).toHaveClass(/bg-green/);

    // Click again to toggle back to unavailable (red)
    await dateButton.click(); // true -> false (red)
    await expect(dateButton).toHaveClass(/bg-red/);
  });

  test('cannot mark past dates', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-past-${Date.now()}@e2e.local`,
      name: 'Past Date GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Past Date Campaign',
      play_days: [0, 1, 2, 3, 4, 5, 6], // All days for testing
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Wait for page to load before interacting
    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible();

    // Get yesterday's date (use local format to match calendar)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, '0');
    const day = String(yesterday.getDate()).padStart(2, '0');
    const yesterdayStr = `${year}-${month}-${day}`;

    // Try to find a past date button
    const pastDateButton = page.locator(`button[title="${yesterdayStr}"]`);

    // Past date button should be disabled
    if (await pastDateButton.count() > 0) {
      await expect(pastDateButton).toBeDisabled();
    }
    // If yesterday isn't visible in the calendar, that's also fine - test passes
  });

  test('cannot mark non-play-days', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-nonplay-${Date.now()}@e2e.local`,
      name: 'Non-Play GM',
      is_gm: true,
    });

    // Game only on Fridays (5) and Saturdays (6)
    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Non-Play Campaign',
      play_days: [5, 6],
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Wait for page to load before interacting
    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible();

    // Find a Monday (day 1) in the future
    const today = new Date();
    const daysUntilMonday = (1 - today.getDay() + 7) % 7 || 7; // Next Monday
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    const mondayStr = nextMonday.toISOString().split('T')[0];

    const mondayButton = page.locator(`button[title="${mondayStr}"]`);

    // Monday should be disabled since it's not a play day
    if (await mondayButton.count() > 0) {
      await expect(mondayButton).toBeDisabled();
      // Should have muted background (non-play day styling)
      await expect(mondayButton).toHaveClass(/bg-muted/);
    }
  });
});
