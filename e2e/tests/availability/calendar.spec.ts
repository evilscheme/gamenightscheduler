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
    
    // Wait for page to load, then switch to availability tab
    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible();
    await page.getByRole('button', { name: /availability/i }).click();

    // Should see "Mark Your Availability" heading
    await expect(page.getByText(/mark your availability/i)).toBeVisible();

    // Should see day headers (S, M, T, W, T, F, S in the calendar)
    await expect(page.getByText(/^S$/).first()).toBeVisible();
    await expect(page.getByText(/^F$/).first()).toBeVisible();
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
    
    // Wait for page to load, then switch to availability tab
    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible();
    await page.getByRole('button', { name: /availability/i }).click();

    // Should see the availability content
    await expect(page.getByText(/mark your availability/i)).toBeVisible();
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
    
    // Wait for page to load, then switch to availability tab
    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible();
    await page.getByRole('button', { name: /availability/i }).click();

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
    
    // Wait for page to load, then switch to availability tab
    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible();
    await page.getByRole('button', { name: /availability/i }).click();

    // Wait for calendar to load
    await expect(page.getByText(/mark your availability/i)).toBeVisible();

    // Should see month headers (Jan 2026, Feb 2026, etc.)
    // The calendar shows abbreviated month names with year
    const monthYearPattern = /\w{3}\s+\d{4}/; // Matches "Jan 2026", "Feb 2026", etc.
    const monthHeaders = await page.getByText(monthYearPattern).count();

    // Should have at least 2 month headers visible
    expect(monthHeaders).toBeGreaterThanOrEqual(2);
  });
});
