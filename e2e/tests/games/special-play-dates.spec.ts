import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame, addPlayerToGame, setAvailability } from '../../helpers/seed';

/**
 * Get a date that is not a play day (assuming play_days is [5] for Friday only).
 * Returns a Thursday date in the current or next month.
 */
function getNonPlayDayDate(): string {
  const today = new Date();
  // Find the next Thursday (day 4)
  const daysUntilThursday = (4 - today.getDay() + 7) % 7 || 7;
  const thursday = new Date(today);
  thursday.setDate(today.getDate() + daysUntilThursday);

  const year = thursday.getFullYear();
  const month = String(thursday.getMonth() + 1).padStart(2, '0');
  const day = String(thursday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

test.describe('Special Play Dates', () => {
  test('GM can see "+" icon on non-play days when hovering', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-special-${Date.now()}@e2e.local`,
      name: 'Special Dates GM',
      is_gm: true,
    });

    // Create game with only Friday as play day
    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Special Dates Test Game',
      play_days: [5], // Friday only
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Switch to availability tab
    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible();
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible();

    // Find a non-play day (Thursday)
    const nonPlayDate = getNonPlayDayDate();

    // Find the button for this day and hover
    const dayButton = page.locator(`button[title*="${nonPlayDate}"]`);
    await dayButton.hover();

    // Should see the "+" icon appear on hover
    const addIcon = dayButton.locator('span:has-text("+")');
    await expect(addIcon).toBeVisible();
  });

  test('GM can enable a non-play day as special play date', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-enable-special-${Date.now()}@e2e.local`,
      name: 'Enable Special GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Enable Special Test Game',
      play_days: [5], // Friday only
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible();
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible();

    const nonPlayDate = getNonPlayDayDate();

    // Find the non-play day button and click the "+" icon
    const dayButton = page.locator(`button[title*="${nonPlayDate}"]`);
    await dayButton.hover();

    const addIcon = dayButton.locator('span:has-text("+")');
    await addIcon.click();

    // After clicking, the day should now have a dashed border (special play date indicator)
    // and the "+" icon should be replaced with "-"
    await expect(dayButton).toHaveClass(/border-dashed/);

    // Now hover again to verify the "-" icon appears
    await dayButton.hover();
    const removeIcon = dayButton.locator('span:has-text("-")');
    await expect(removeIcon).toBeVisible();
  });

  test('GM can disable a special play date', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-disable-special-${Date.now()}@e2e.local`,
      name: 'Disable Special GM',
      is_gm: true,
    });

    const nonPlayDate = getNonPlayDayDate();

    // Create game with a special play date already set
    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Disable Special Test Game',
      play_days: [5], // Friday only
      special_play_dates: [nonPlayDate],
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible();
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible();

    // Find the special play date - it should have dashed border
    const dayButton = page.locator(`button[title*="${nonPlayDate}"]`);
    await expect(dayButton).toHaveClass(/border-dashed/);

    // Hover and click the "-" icon to remove
    await dayButton.hover();
    const removeIcon = dayButton.locator('span:has-text("-")');
    await removeIcon.click();

    // After removing, the day should go back to being a non-play day (cross-hatched)
    await expect(dayButton).toHaveClass(/non-play-day/);
  });

  test('special play dates appear as playable for availability marking', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-playable-special-${Date.now()}@e2e.local`,
      name: 'Playable Special GM',
      is_gm: true,
    });

    const nonPlayDate = getNonPlayDayDate();

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Playable Special Test Game',
      play_days: [5], // Friday only
      special_play_dates: [nonPlayDate],
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible();
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible();

    // Click on the special play date to mark availability
    const dayButton = page.locator(`button[title*="${nonPlayDate}"]`);
    await dayButton.click();

    // Should turn green (available)
    await expect(dayButton).toHaveClass(/bg-success/);

    // Click again to cycle to unavailable
    await dayButton.click();
    await expect(dayButton).toHaveClass(/bg-danger/);
  });

  test('players can mark availability on special play dates', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-player-special-${Date.now()}@e2e.local`,
      name: 'Player Special GM',
      is_gm: true,
    });

    const player = await createTestUser(request, {
      email: `player-special-${Date.now()}@e2e.local`,
      name: 'Special Player',
      is_gm: false,
    });

    const nonPlayDate = getNonPlayDayDate();

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Player Special Test Game',
      play_days: [5], // Friday only
      special_play_dates: [nonPlayDate],
    });

    await addPlayerToGame(game.id, player.id);

    // Login as player
    await loginTestUser(page, {
      email: player.email,
      name: player.name,
      is_gm: false,
    });

    await page.goto(`/games/${game.id}`);

    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible();
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible();

    // Player should be able to click on special play date
    const dayButton = page.locator(`button[title*="${nonPlayDate}"]`);
    await dayButton.click();

    // Should turn green (available)
    await expect(dayButton).toHaveClass(/bg-success/);
  });

  test('players cannot enable/disable special play dates (no +/- icons)', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-no-icons-${Date.now()}@e2e.local`,
      name: 'No Icons GM',
      is_gm: true,
    });

    const player = await createTestUser(request, {
      email: `player-no-icons-${Date.now()}@e2e.local`,
      name: 'No Icons Player',
      is_gm: false,
    });

    const nonPlayDate = getNonPlayDayDate();

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'No Icons Test Game',
      play_days: [5], // Friday only
    });

    await addPlayerToGame(game.id, player.id);

    // Login as player
    await loginTestUser(page, {
      email: player.email,
      name: player.name,
      is_gm: false,
    });

    await page.goto(`/games/${game.id}`);

    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible();
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible();

    // Find a non-play day and hover
    const dayButton = page.locator(`button[title*="${nonPlayDate}"]`);
    await dayButton.hover();

    // Should NOT see any "+/-" icons as player
    const addIcon = dayButton.locator('span:has-text("+")');
    await expect(addIcon).not.toBeVisible();
  });

  test('special play dates appear in scheduling suggestions', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-suggestions-${Date.now()}@e2e.local`,
      name: 'Suggestions GM',
      is_gm: true,
    });

    const nonPlayDate = getNonPlayDayDate();

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Suggestions Test Game',
      play_days: [5], // Friday only
      special_play_dates: [nonPlayDate],
    });

    // Set availability for the GM on the special date
    await setAvailability(gm.id, game.id, [
      { date: nonPlayDate, status: 'available' },
    ]);

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Switch to schedule tab
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible();
    await page.getByRole('button', { name: /schedule/i }).click();

    // The special date should appear in the suggestions
    // Format the date for display (e.g., "Thu, Jan 23")
    const dateObj = new Date(nonPlayDate + 'T00:00:00');
    const monthAbbr = dateObj.toLocaleDateString('en-US', { month: 'short' });
    const dayNum = dateObj.getDate();

    // Look for the date in the suggestions (format: "Thu, Jan 23" or similar)
    await expect(page.getByText(new RegExp(`${monthAbbr}.*${dayNum}|${dayNum}.*${monthAbbr}`, 'i'))).toBeVisible();
  });

  test('legend shows "Special play date" entry', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-legend-${Date.now()}@e2e.local`,
      name: 'Legend GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Legend Test Game',
      play_days: [5],
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible();
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible();

    // Should see "Special play date" in the legend
    await expect(page.getByText(/special play date/i)).toBeVisible();
  });
});
