import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame, addPlayerToGame, createGamePlayDate, setAvailability } from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

/**
 * Get a future date string (YYYY-MM-DD) for a specific day-of-week offset from today.
 */
function getFutureDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

test.describe('Ad-Hoc Games', () => {
  test.describe('Game Creation', () => {
    test('GM can create an ad-hoc only game', async ({ page }) => {
      await loginTestUser(page, {
        email: `gm-adhoc-create-${Date.now()}@e2e.local`,
        name: 'Ad-Hoc Creator GM',
        is_gm: true,
      });

      await page.goto('/games/new');
      await expect(page.getByRole('heading', { name: /create new game/i })).toBeVisible();

      // Fill game name
      await page.getByPlaceholder(/friday night board games/i).fill('Ad-Hoc Board Games');

      // Enable ad-hoc scheduling toggle (sr-only checkbox needs force)
      const toggle = page.locator('input[type="checkbox"]').first();
      await toggle.check({ force: true });

      // Play day buttons should be hidden
      await expect(page.getByRole('button', { name: 'Friday' })).not.toBeVisible();

      // Warning message should be visible
      await expect(page.getByText(/no dates will appear on the calendar automatically/i)).toBeVisible();

      // Submit the form
      await page.getByRole('button', { name: /create game/i }).click();

      // Should redirect to game detail page
      await expect(page).toHaveURL(/\/games\/[a-f0-9-]+$/);

      // Should see the game name
      await expect(page.getByRole('heading', { name: /ad-hoc board games/i })).toBeVisible();
    });

    test('ad-hoc toggle hides play day buttons and shows warning', async ({ page }) => {
      await loginTestUser(page, {
        email: `gm-adhoc-toggle-${Date.now()}@e2e.local`,
        name: 'Toggle GM',
        is_gm: true,
      });

      await page.goto('/games/new');
      await expect(page.getByRole('heading', { name: /create new game/i })).toBeVisible();

      // Play day buttons should be visible initially
      await expect(page.getByRole('button', { name: 'Friday' })).toBeVisible();

      // Enable ad-hoc mode (sr-only checkbox needs force)
      const toggle = page.locator('input[type="checkbox"]').first();
      await toggle.check({ force: true });

      // Play day buttons should be hidden
      await expect(page.getByRole('button', { name: 'Friday' })).not.toBeVisible();
      await expect(page.getByText(/no dates will appear on the calendar automatically/i)).toBeVisible();

      // Disable ad-hoc mode
      await toggle.uncheck({ force: true });

      // Play day buttons should reappear
      await expect(page.getByRole('button', { name: 'Friday' })).toBeVisible();
      await expect(page.getByText(/no dates will appear on the calendar automatically/i)).not.toBeVisible();
    });

    test('ad-hoc game does not require play days for form submission', async ({ page }) => {
      await loginTestUser(page, {
        email: `gm-adhoc-nodays-${Date.now()}@e2e.local`,
        name: 'No Days GM',
        is_gm: true,
      });

      await page.goto('/games/new');
      await expect(page.getByRole('heading', { name: /create new game/i })).toBeVisible();

      // Fill game name
      await page.getByPlaceholder(/friday night board games/i).fill('No Days Game');

      // Enable ad-hoc mode (no play days selected, sr-only checkbox needs force)
      const toggle = page.locator('input[type="checkbox"]').first();
      await toggle.check({ force: true });

      // Submit should work without selecting play days
      await page.getByRole('button', { name: /create game/i }).click();

      // Should redirect to game detail page
      await expect(page).toHaveURL(/\/games\/[a-f0-9-]+$/);
    });
  });

  test.describe('Dashboard Display', () => {
    test('ad-hoc game shows "Ad-hoc" instead of play days on dashboard', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-adhoc-dash-${Date.now()}@e2e.local`,
        name: 'Dashboard Ad-Hoc GM',
        is_gm: true,
      });

      await createTestGame({
        gm_id: gm.id,
        name: 'My Ad-Hoc Campaign',
        play_days: [],
        ad_hoc_only: true,
      });

      await loginTestUser(page, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await page.goto('/dashboard');
      const gameCard = page.locator('a', { hasText: 'My Ad-Hoc Campaign' });
      await expect(gameCard).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Should show "Ad-hoc" instead of day abbreviations within the game card
      await expect(gameCard.getByText('Ad-hoc', { exact: true })).toBeVisible();
    });
  });

  test.describe('Game Details Card', () => {
    test('ad-hoc game shows "Ad-hoc dates only" in overview', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-adhoc-details-${Date.now()}@e2e.local`,
        name: 'Details Ad-Hoc GM',
        is_gm: true,
      });

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Details Ad-Hoc Game',
        play_days: [],
        ad_hoc_only: true,
      });

      await loginTestUser(page, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);
      await expect(page.getByRole('heading', { name: /details ad-hoc game/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Overview tab should show "Ad-hoc dates only"
      await expect(page.getByText('Ad-hoc dates only')).toBeVisible();
    });
  });

  test.describe('Calendar — GM Adding Play Dates', () => {
    test('GM sees + icon on all dates for ad-hoc game', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-adhoc-plus-${Date.now()}@e2e.local`,
        name: 'Plus Icon GM',
        is_gm: true,
      });

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Plus Icon Game',
        play_days: [],
        ad_hoc_only: true,
      });

      await loginTestUser(page, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);
      await page.getByRole('button', { name: /availability/i }).click();
      await expect(page.getByText(/mark your availability/i)).toBeVisible();

      // GM should see helper text about adding dates
      await expect(page.getByText(/add potential play dates/i)).toBeVisible();

      // Hover a future date — should see add icon since no play days are set
      const futureDate = getFutureDate(3);
      const dayButton = page.locator(`button[data-date="${futureDate}"]`);
      await dayButton.hover();

      const addIcon = dayButton.locator('span[title="Enable as special play date"]');
      await expect(addIcon).toBeVisible();
    });

    test('GM can add a play date and mark availability on it', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-adhoc-add-${Date.now()}@e2e.local`,
        name: 'Add Date GM',
        is_gm: true,
      });

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Add Date Game',
        play_days: [],
        ad_hoc_only: true,
      });

      await loginTestUser(page, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);
      await page.getByRole('button', { name: /availability/i }).click();
      await expect(page.getByText(/mark your availability/i)).toBeVisible();

      // Add a play date via the + icon
      const futureDate = getFutureDate(5);
      const dayButton = page.locator(`button[data-date="${futureDate}"]`);
      await dayButton.hover();

      const addIcon = dayButton.locator('span[title="Enable as special play date"]');
      await addIcon.click();

      // Should now be a special play date
      await expect(dayButton).toHaveAttribute('data-special', 'true');

      // Click it to mark as available
      await dayButton.click();
      await expect(dayButton).toHaveAttribute('data-status', 'available');
    });

    test('player sees message when no play dates exist yet', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-adhoc-empty-${Date.now()}@e2e.local`,
        name: 'Empty Dates GM',
        is_gm: true,
      });

      const player = await createTestUser(request, {
        email: `player-adhoc-empty-${Date.now()}@e2e.local`,
        name: 'Empty Dates Player',
        is_gm: false,
      });

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Empty Dates Game',
        play_days: [],
        ad_hoc_only: true,
      });

      await addPlayerToGame(game.id, player.id);

      await loginTestUser(page, {
        email: player.email,
        name: player.name,
        is_gm: false,
      });

      await page.goto(`/games/${game.id}`);
      await page.getByRole('button', { name: /availability/i }).click();
      await expect(page.getByText(/mark your availability/i)).toBeVisible();

      // Player should see message about no play dates yet
      await expect(page.getByText(/no play dates have been added yet/i)).toBeVisible();
    });
  });

  test.describe('Calendar — Player Availability on Ad-Hoc Dates', () => {
    test('player can mark availability on GM-added play dates', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-adhoc-player-${Date.now()}@e2e.local`,
        name: 'Player Avail GM',
        is_gm: true,
      });

      const player = await createTestUser(request, {
        email: `player-adhoc-avail-${Date.now()}@e2e.local`,
        name: 'Ad-Hoc Player',
        is_gm: false,
      });

      const futureDate = getFutureDate(7);

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Player Avail Game',
        play_days: [],
        ad_hoc_only: true,
      });

      // Add a play date via seed helper
      await createGamePlayDate(game.id, futureDate);
      await addPlayerToGame(game.id, player.id);

      await loginTestUser(page, {
        email: player.email,
        name: player.name,
        is_gm: false,
      });

      await page.goto(`/games/${game.id}`);
      await page.getByRole('button', { name: /availability/i }).click();
      await expect(page.getByText(/mark your availability/i)).toBeVisible();

      // The play date should be a special date that the player can click
      const dayButton = page.locator(`button[data-date="${futureDate}"]`);
      await expect(dayButton).toHaveAttribute('data-special', 'true');

      // Click to mark as available
      await dayButton.click();
      await expect(dayButton).toHaveAttribute('data-status', 'available');

      // Click again to cycle to unavailable
      await dayButton.click();
      await expect(dayButton).toHaveAttribute('data-status', 'unavailable');
    });
  });

  test.describe('Scheduling Suggestions', () => {
    test('ad-hoc play dates appear in scheduling suggestions', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-adhoc-sug-${Date.now()}@e2e.local`,
        name: 'Suggestions GM',
        is_gm: true,
      });

      const futureDate = getFutureDate(10);

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Suggestions Ad-Hoc Game',
        play_days: [],
        ad_hoc_only: true,
      });

      // Add a play date and set availability
      await createGamePlayDate(game.id, futureDate);
      await setAvailability(gm.id, game.id, [
        { date: futureDate, status: 'available' },
      ]);

      await loginTestUser(page, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);
      await page.getByRole('button', { name: /schedule/i }).click();

      // The ad-hoc date should appear in suggestions
      const dateObj = new Date(futureDate + 'T00:00:00');
      const dayNum = dateObj.getDate();

      // Look for the date in suggestions (contains the day number)
      await expect(page.getByText(new RegExp(`${dayNum}`))).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Should show 1 available
      await expect(page.getByText(/1 available/)).toBeVisible();
    });
  });

  test.describe('Edit Form — Ad-Hoc Toggle', () => {
    test('edit form shows ad-hoc toggle pre-checked for ad-hoc game', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-adhoc-edit-${Date.now()}@e2e.local`,
        name: 'Edit Ad-Hoc GM',
        is_gm: true,
      });

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Edit Ad-Hoc Game',
        play_days: [],
        ad_hoc_only: true,
      });

      await loginTestUser(page, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}/edit`);
      await expect(page.getByRole('heading', { name: /edit game/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // The ad-hoc toggle should be checked (edit form uses role="switch")
      const toggle = page.getByRole('switch');
      await expect(toggle).toHaveAttribute('aria-checked', 'true');

      // Play day buttons should not be visible
      await expect(page.getByRole('button', { name: 'Friday' })).not.toBeVisible();
    });

    test('disabling ad-hoc mode shows play day buttons again', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-adhoc-disable-${Date.now()}@e2e.local`,
        name: 'Disable Ad-Hoc GM',
        is_gm: true,
      });

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Disable Ad-Hoc Game',
        play_days: [],
        ad_hoc_only: true,
      });

      await loginTestUser(page, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}/edit`);
      await expect(page.getByRole('heading', { name: /edit game/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Uncheck ad-hoc toggle (edit form uses role="switch")
      const toggle = page.getByRole('switch');
      await toggle.click();

      // Play day buttons should now be visible
      await expect(page.getByRole('button', { name: 'Friday' })).toBeVisible();
    });
  });
});
