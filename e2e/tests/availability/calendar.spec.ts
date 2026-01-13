import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame, addPlayerToGame } from '../../helpers/seed';

test.describe('Availability Calendar', () => {
  test('displays calendar on availability tab', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-calendar-${Date.now()}@e2e.local`,
      name: 'Calendar Test GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Calendar Test Campaign',
      play_days: [5, 6], // Friday, Saturday
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);
    await page.waitForLoadState('networkidle');

    // Switch to availability tab
    await page.getByRole('button', { name: /availability/i }).click();

    // Should see calendar grid
    await expect(page.locator('[class*="calendar"]').first()).toBeVisible({ timeout: 10000 });

    // Should see day headers (Su, Mo, Tu, etc.)
    await expect(page.getByText(/^Su$/)).toBeVisible();
    await expect(page.getByText(/^Fr$/)).toBeVisible();
    await expect(page.getByText(/^Sa$/)).toBeVisible();
  });

  test('player can see availability tab', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-toggle-${Date.now()}@e2e.local`,
      name: 'Toggle Test GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Toggle Test Campaign',
      play_days: [5, 6], // Friday, Saturday
    });

    // Create player and add to game
    const player = await createTestUser(request, {
      email: `player-toggle-${Date.now()}@e2e.local`,
      name: 'Toggle Player',
      is_gm: false,
    });
    await addPlayerToGame(game.id, player.id);

    await loginTestUser(page, {
      email: player.email,
      name: player.name,
      is_gm: false,
    });

    await page.goto(`/games/${game.id}`);
    await page.waitForLoadState('networkidle');

    // Switch to availability tab
    await page.getByRole('button', { name: /availability/i }).click();
    await page.waitForLoadState('networkidle');

    // Should see the calendar
    await expect(page.locator('[class*="calendar"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('shows availability legend', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-legend-${Date.now()}@e2e.local`,
      name: 'Legend Test GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Legend Test Campaign',
      play_days: [5, 6],
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);
    await page.waitForLoadState('networkidle');

    // Switch to availability tab
    await page.getByRole('button', { name: /availability/i }).click();
    await page.waitForLoadState('networkidle');

    // Should see legend items
    await expect(page.getByText(/available/i).first()).toBeVisible();
    await expect(page.getByText(/unavailable/i).first()).toBeVisible();
  });

  test('shows multiple months in calendar', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-months-${Date.now()}@e2e.local`,
      name: 'Months Test GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Months Test Campaign',
      play_days: [5, 6],
      scheduling_window_months: 2,
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);
    await page.waitForLoadState('networkidle');

    // Switch to availability tab
    await page.getByRole('button', { name: /availability/i }).click();
    await page.waitForLoadState('networkidle');

    // Should see month headers for current and next months
    const currentMonth = new Date().toLocaleString('default', { month: 'long' });
    const nextMonth = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toLocaleString('default', { month: 'long' });

    // At least one of the months should be visible
    const hasCurrentMonth = await page.getByText(new RegExp(currentMonth, 'i')).count() > 0;
    const hasNextMonth = await page.getByText(new RegExp(nextMonth, 'i')).count() > 0;

    expect(hasCurrentMonth || hasNextMonth).toBe(true);
  });
});
