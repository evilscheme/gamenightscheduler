import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import {
  createTestGame,
  addPlayerToGame,
  setAvailability,
  getPlayDates,
  getPastPlayDates,
} from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

/**
 * Returns an ISO date string N months from today, on a fixed day-of-month.
 * Mirrors the helper in e2e/tests/games/campaign-dates.spec.ts.
 */
function futureDate(monthsAhead: number, day: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + monthsAhead);
  date.setDate(day);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${d}`;
}

/** The next Sunday (day-of-week 0) starting tomorrow, as yyyy-MM-dd. */
function nextNonPlayDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  while (date.getDay() !== 0) {
    date.setDate(date.getDate() + 1);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${d}`;
}

test.describe('availability day tooltip', () => {
  // Play days Mon-Sat (1-6); Sunday (0) is the deliberate non-play day.
  const PLAY_DAYS = [1, 2, 3, 4, 5, 6];

  let availableDate: string;
  let unsetDate: string;
  let pastDate: string;
  let nonPlayDate: string;
  let outOfRangeDate: string;

  test.beforeEach(async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-tooltip-${Date.now()}@e2e.local`,
      name: 'Tooltip GM',
      is_gm: true,
    });
    const player = await createTestUser(request, {
      email: `player-tooltip-${Date.now()}@e2e.local`,
      name: 'Tooltip Player',
      is_gm: false,
    });

    // Cap the campaign well inside the default 2-month window so the last
    // rendered month has real, in-grid out-of-range days after the cutoff
    // (a bare scheduling_window_months with no campaign_end_date ends
    // exactly on a month boundary, which leaves nothing to hover past it).
    const campaignEnd = futureDate(2, 10);
    outOfRangeDate = futureDate(2, 20);

    const game = await createTestGame({
      gm_id: gm.id,
      name: `Tooltip Game ${Date.now()}`,
      play_days: PLAY_DAYS,
      scheduling_window_months: 2,
      campaign_end_date: campaignEnd,
    });

    await addPlayerToGame(game.id, player.id);

    const upcomingPlayDates = getPlayDates(PLAY_DAYS, 1);
    availableDate = upcomingPlayDates[0];
    unsetDate = upcomingPlayDates[1];
    pastDate = getPastPlayDates(PLAY_DAYS, 1)[0];
    nonPlayDate = nextNonPlayDate();

    await setAvailability(player.id, game.id, [
      { date: availableDate, status: 'available' as const },
    ]);
    // unsetDate is deliberately left with no availability row (pending).

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
    await expect(page.getByText(/mark your availability/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
  });

  test('names the status of an answered play day', async ({ page }) => {
    await page.locator(`button[data-date="${availableDate}"]`).hover();
    const tip = page.getByTestId('day-tooltip');
    await expect(tip).toBeVisible();
    await expect(tip).toContainText('Available');
    await expect(tip).toContainText('Click to mark Unavailable');
  });

  test('names the status of an unanswered play day', async ({ page }) => {
    await page.locator(`button[data-date="${unsetDate}"]`).hover();
    const tip = page.getByTestId('day-tooltip');
    await expect(tip).toBeVisible();
    await expect(tip).toContainText('Not set');
  });

  test('explains a past cell, which used to say nothing', async ({ page }) => {
    await page.locator(`button[data-date="${pastDate}"]`).hover();
    const tip = page.getByTestId('day-tooltip');
    await expect(tip).toBeVisible();
    await expect(tip).toContainText('Past');
  });

  test('explains a non-play day', async ({ page }) => {
    await page.locator(`button[data-date="${nonPlayDate}"]`).hover();
    const tip = page.getByTestId('day-tooltip');
    await expect(tip).toBeVisible();
    await expect(tip).toContainText('Not a play day');
  });

  test('names the campaign bound on an out-of-range cell', async ({ page }) => {
    await page.locator(`button[data-date="${outOfRangeDate}"]`).hover();
    const tip = page.getByTestId('day-tooltip');
    await expect(tip).toBeVisible();
    await expect(tip).toContainText('campaign');
  });

  test('shows exactly one tooltip while moving between cells', async ({ page }) => {
    const tip = page.getByTestId('day-tooltip');

    await page.locator(`button[data-date="${unsetDate}"]`).hover();
    await expect(tip).toBeVisible();
    await expect(tip).toContainText('Not set');

    await page.locator(`button[data-date="${availableDate}"]`).hover();
    await expect(tip).toBeVisible();
    await expect(tip).toContainText('Available');

    await expect(tip).toHaveCount(1);
  });
});
