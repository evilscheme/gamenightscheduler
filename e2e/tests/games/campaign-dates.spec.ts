import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame, addPlayerToGame } from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

/**
 * Returns a future ISO date string offset by the given number of months from today.
 * Also returns a RegExp pattern that matches locale-dependent formatted output.
 */
function futureDate(monthsAhead: number, day: number = 15) {
  const date = new Date();
  date.setMonth(date.getMonth() + monthsAhead);
  date.setDate(day);

  const year = date.getFullYear();
  const month = date.getMonth();
  const d = date.getDate();

  const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const shortMonth = date.toLocaleDateString('en-US', { month: 'short' });
  // Match "Mar 15, 2026" or "15 Mar 2026" or similar locale variants
  const pattern = new RegExp(`(${shortMonth}\\s+${d}|${d}\\s+${shortMonth}).+${year}`);

  return { iso, pattern };
}

/**
 * Returns a past ISO date string offset by the given number of months before today.
 */
function pastDate(monthsAgo: number, day: number = 15) {
  const date = new Date();
  date.setMonth(date.getMonth() - monthsAgo);
  date.setDate(day);

  const year = date.getFullYear();
  const month = date.getMonth();
  const d = date.getDate();

  return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Returns an ISO date string for N days from today.
 */
function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${d}`;
}

test.describe('Campaign Dates', () => {
  test.describe('Game Creation & Editing', () => {
    test('GM can create a game with campaign dates', async ({ page }) => {
      const startDate = futureDate(2, 15);
      const endDate = futureDate(7, 28);

      await loginTestUser(page, {
        email: `gm-campaign-${Date.now()}@e2e.local`,
        name: 'Campaign GM',
        is_gm: true,
      });

      await page.goto('/games/new');
      await expect(
        page.getByRole('heading', { name: /create new game/i })
      ).toBeVisible();

      // Fill basic info
      await page.getByPlaceholder(/friday night board games/i).fill('Campaign Test');
      await page.getByRole('button', { name: 'Friday' }).click();

      // Enable custom campaign date toggles, then fill dates
      await page.getByRole('switch', { name: /custom start date/i }).click();
      await page.fill('#campaign-start', startDate.iso);
      await page.getByRole('switch', { name: /custom end date/i }).click();
      await page.fill('#campaign-end', endDate.iso);

      // Submit
      await page.getByRole('button', { name: /create game/i }).click();
      await expect(page).toHaveURL(/\/games\/[a-f0-9-]+$/);

      // Verify dates show in game details
      await expect(page.getByText(startDate.pattern)).toBeVisible();
      await expect(page.getByText(endDate.pattern)).toBeVisible();
    });

    test('GM can edit campaign dates', async ({ page }) => {
      const startDate = futureDate(3, 1);
      const endDate = futureDate(8, 20);

      await loginTestUser(page, {
        email: `gm-edit-campaign-${Date.now()}@e2e.local`,
        name: 'Edit Campaign GM',
        is_gm: true,
      });

      // Create a game first
      await page.goto('/games/new');
      await expect(
        page.getByRole('heading', { name: /create new game/i })
      ).toBeVisible();
      await page.getByPlaceholder(/friday night board games/i).fill('Edit Campaign Test');
      await page.getByRole('button', { name: 'Saturday' }).click();
      await page.getByRole('button', { name: /create game/i }).click();
      await expect(page).toHaveURL(/\/games\/[a-f0-9-]+$/);

      // Go to edit page via Edit button
      await page.getByRole('button', { name: /^edit$/i }).click();
      await expect(
        page.getByRole('heading', { name: /edit game/i })
      ).toBeVisible();

      // Enable custom campaign date toggles, then fill dates
      await page.getByRole('switch', { name: /custom start date/i }).click();
      await page.fill('#campaign-start', startDate.iso);
      await page.getByRole('switch', { name: /custom end date/i }).click();
      await page.fill('#campaign-end', endDate.iso);

      // Save
      await page.getByRole('button', { name: /save changes/i }).click();

      // Should redirect back to game detail page
      await expect(page).toHaveURL(/\/games\/[a-f0-9-]+$/);

      // Verify dates show after save
      await expect(page.getByText(startDate.pattern)).toBeVisible();
      await expect(page.getByText(endDate.pattern)).toBeVisible();
    });

    test('expanded scheduling window options are available', async ({ page }) => {
      await loginTestUser(page, {
        email: `gm-window-opts-${Date.now()}@e2e.local`,
        name: 'Window Options GM',
        is_gm: true,
      });

      await page.goto('/games/new');
      await expect(
        page.getByRole('heading', { name: /create new game/i })
      ).toBeVisible();

      // Check that 6 and 12 month options exist in the scheduling window select
      const select = page.locator('#scheduling-window');
      await expect(select.locator('option[value="6"]')).toHaveText('6 months ahead');
      await expect(select.locator('option[value="12"]')).toHaveText('12 months ahead');
    });
  });

  test.describe('Calendar Window Rendering', () => {
    test('future campaign start shows calendar months (not empty)', async ({ page, request }) => {
      // This is the core bug fix: a campaign starting 4 months out with a 2-month
      // window should show those future months, not an empty calendar.
      const gm = await createTestUser(request, {
        email: `gm-future-cal-${Date.now()}@e2e.local`,
        name: 'Future Campaign GM',
        is_gm: true,
      });

      const campaignStart = futureDate(4, 1);
      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Future Campaign Game',
        play_days: [5], // Friday
        scheduling_window_months: 2,
        campaign_start_date: campaignStart.iso,
      });

      await loginTestUser(page, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);
      await page.getByRole('button', { name: /availability/i }).click();
      await expect(page.getByText(/mark your availability/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Calendar should render at least one month grid — there should be day buttons
      const dayButtons = page.locator('button[data-date]');
      await expect(dayButtons.first()).toBeVisible();

      // There should be a meaningful number of day cells
      const count = await dayButtons.count();
      expect(count).toBeGreaterThan(20);
    });

    test('campaign with past start and future end shows calendar from today', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-past-start-${Date.now()}@e2e.local`,
        name: 'Past Start GM',
        is_gm: true,
      });

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Past Start Campaign',
        play_days: [5], // Friday
        scheduling_window_months: 2,
        campaign_start_date: pastDate(3, 1),
        campaign_end_date: futureDate(6, 28).iso,
      });

      await loginTestUser(page, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);
      await page.getByRole('button', { name: /availability/i }).click();
      await expect(page.getByText(/mark your availability/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Calendar should render (campaign started in the past, still ongoing)
      const dayButtons = page.locator('button[data-date]');
      await expect(dayButtons.first()).toBeVisible();

      // Today's date should be present in the calendar
      const todayStr = daysFromNow(0);
      await expect(page.locator(`button[data-date="${todayStr}"]`)).toBeVisible();
    });
  });

  test.describe('Out-of-Range Visual Indicators', () => {
    test('dates before campaign start have out-of-range data-status', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-oor-start-${Date.now()}@e2e.local`,
        name: 'OOR Start GM',
        is_gm: true,
      });

      // Campaign starts ~2 weeks from now — dates before it should be out-of-range
      const campaignStart = daysFromNow(14);
      const game = await createTestGame({
        gm_id: gm.id,
        name: 'OOR Start Game',
        play_days: [0, 1, 2, 3, 4, 5, 6], // Every day for easy testing
        scheduling_window_months: 2,
        campaign_start_date: campaignStart,
      });

      await loginTestUser(page, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);
      await page.getByRole('button', { name: /availability/i }).click();
      await expect(page.getByText(/mark your availability/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // A date between today and campaign start should be out-of-range
      const midDate = daysFromNow(7);
      const midCell = page.locator(`button[data-date="${midDate}"]`);

      // The cell may or may not exist (depends on whether the month is rendered)
      // If it exists, it should have out-of-range status
      if (await midCell.isVisible()) {
        await expect(midCell).toHaveAttribute('data-status', 'out-of-range');
      }

      // A date after campaign start should NOT be out-of-range
      const afterStart = daysFromNow(21);
      const afterCell = page.locator(`button[data-date="${afterStart}"]`);
      if (await afterCell.isVisible()) {
        const status = await afterCell.getAttribute('data-status');
        expect(status).not.toBe('out-of-range');
      }
    });

    test('dates after campaign end have out-of-range data-status', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-oor-end-${Date.now()}@e2e.local`,
        name: 'OOR End GM',
        is_gm: true,
      });

      // Campaign ends ~3 weeks from now
      const campaignEnd = daysFromNow(21);
      const game = await createTestGame({
        gm_id: gm.id,
        name: 'OOR End Game',
        play_days: [0, 1, 2, 3, 4, 5, 6],
        scheduling_window_months: 2,
        campaign_end_date: campaignEnd,
      });

      await loginTestUser(page, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);
      await page.getByRole('button', { name: /availability/i }).click();
      await expect(page.getByText(/mark your availability/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // A date well after campaign end should be out-of-range
      const afterEnd = daysFromNow(35);
      const afterCell = page.locator(`button[data-date="${afterEnd}"]`);
      if (await afterCell.isVisible()) {
        await expect(afterCell).toHaveAttribute('data-status', 'out-of-range');
      }

      // A date before campaign end should NOT be out-of-range
      const beforeEnd = daysFromNow(7);
      const beforeCell = page.locator(`button[data-date="${beforeEnd}"]`);
      if (await beforeCell.isVisible()) {
        const status = await beforeCell.getAttribute('data-status');
        expect(status).not.toBe('out-of-range');
      }
    });

    test('out-of-range cells are disabled (cannot be clicked)', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-oor-disabled-${Date.now()}@e2e.local`,
        name: 'OOR Disabled GM',
        is_gm: true,
      });

      // Campaign starts in 2 weeks — cells before that are out-of-range
      const campaignStart = daysFromNow(14);
      const game = await createTestGame({
        gm_id: gm.id,
        name: 'OOR Disabled Game',
        play_days: [0, 1, 2, 3, 4, 5, 6],
        scheduling_window_months: 2,
        campaign_start_date: campaignStart,
      });

      await loginTestUser(page, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);
      await page.getByRole('button', { name: /availability/i }).click();
      await expect(page.getByText(/mark your availability/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Find an out-of-range cell
      const outOfRangeCell = page.locator('button[data-status="out-of-range"]').first();
      if (await outOfRangeCell.isVisible()) {
        // The button should be disabled
        await expect(outOfRangeCell).toBeDisabled();
      }
    });
  });

  test.describe('Legend', () => {
    test('shows "Outside campaign" legend entry when game has campaign dates', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-legend-${Date.now()}@e2e.local`,
        name: 'Legend GM',
        is_gm: true,
      });

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Legend Campaign Game',
        play_days: [5], // Friday
        scheduling_window_months: 2,
        campaign_start_date: daysFromNow(14),
        campaign_end_date: futureDate(4, 28).iso,
      });

      await loginTestUser(page, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);
      await page.getByRole('button', { name: /availability/i }).click();
      await expect(page.getByText(/mark your availability/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // "Outside campaign" legend entry should be visible
      await expect(page.getByText('Outside campaign')).toBeVisible();
    });

    test('does NOT show "Outside campaign" legend for games without campaign dates', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-no-legend-${Date.now()}@e2e.local`,
        name: 'No Legend GM',
        is_gm: true,
      });

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'No Campaign Game',
        play_days: [5], // Friday
        scheduling_window_months: 2,
        // No campaign dates
      });

      await loginTestUser(page, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);
      await page.getByRole('button', { name: /availability/i }).click();
      await expect(page.getByText(/mark your availability/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // "Outside campaign" legend entry should NOT be present
      await expect(page.getByText('Outside campaign')).not.toBeVisible();
    });
  });

  test.describe('Player Experience', () => {
    test('player sees out-of-range indicators on game with campaign dates', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-player-oor-${Date.now()}@e2e.local`,
        name: 'Player OOR GM',
        is_gm: true,
      });

      const player = await createTestUser(request, {
        email: `player-oor-${Date.now()}@e2e.local`,
        name: 'OOR Player',
        is_gm: false,
      });

      // Campaign starts in 2 weeks, ends in 3 months
      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Player OOR Game',
        play_days: [0, 1, 2, 3, 4, 5, 6],
        scheduling_window_months: 3,
        campaign_start_date: daysFromNow(14),
        campaign_end_date: futureDate(3, 28).iso,
      });

      await addPlayerToGame(game.id, player.id);

      await loginTestUser(page, {
        email: player.email,
        name: player.name,
        is_gm: false,
      });

      await page.goto(`/games/${game.id}`);
      await page.getByRole('button', { name: /availability/i }).click();
      await expect(page.getByText(/mark your availability/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Player should see "Outside campaign" in the legend
      await expect(page.getByText('Outside campaign')).toBeVisible();

      // There should be at least some out-of-range cells visible
      const oorCells = page.locator('button[data-status="out-of-range"]');
      const oorCount = await oorCells.count();
      expect(oorCount).toBeGreaterThan(0);
    });
  });
});
