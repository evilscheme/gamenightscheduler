import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame, createTestSession, getPlayDates } from '../../helpers/seed';

test.describe('Game Timezone', () => {
  test('timezone dropdown appears in game create form', async ({ page }) => {
    await loginTestUser(page, {
      email: `gm-tz-create-${Date.now()}@e2e.local`,
      name: 'Timezone Create GM',
      is_gm: true,
    });

    await page.goto('/games/new');

    // Wait for form to load
    await expect(page.getByRole('heading', { name: /create new game/i })).toBeVisible();

    // Should see timezone dropdown
    const timezoneSelect = page.locator('label:has-text("Timezone")').locator('..').locator('select');
    await expect(timezoneSelect).toBeVisible();

    // Should have a sensible default selected (browser timezone or fallback)
    const selectedValue = await timezoneSelect.inputValue();
    expect(selectedValue).toBeTruthy();
  });

  test('can create a game with specific timezone', async ({ page }) => {
    await loginTestUser(page, {
      email: `gm-tz-specific-${Date.now()}@e2e.local`,
      name: 'Timezone Specific GM',
      is_gm: true,
    });

    await page.goto('/games/new');

    // Wait for form to load
    await expect(page.getByRole('heading', { name: /create new game/i })).toBeVisible();

    // Fill required fields
    await page.getByPlaceholder(/friday night board games/i).fill('Eastern Time Game');
    await page.getByRole('button', { name: 'Saturday' }).click();

    // Select Eastern Time zone
    const timezoneSelect = page.locator('label:has-text("Timezone")').locator('..').locator('select');
    await timezoneSelect.selectOption('America/New_York');

    // Submit
    await page.getByRole('button', { name: /create game/i }).click();

    // Should redirect successfully
    await expect(page).toHaveURL(/\/games\/[a-f0-9-]+$/);

    // Should see New York timezone in game details
    await expect(page.getByText(/New York/)).toBeVisible();
  });

  test('timezone is displayed in game details', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-tz-display-${Date.now()}@e2e.local`,
      name: 'Timezone Display GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Display Timezone Game',
      play_days: [5, 6],
      timezone: 'Europe/London',
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Should see timezone displayed
    await expect(page.getByText(/London/)).toBeVisible();
  });

  test('can edit game timezone', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-tz-edit-${Date.now()}@e2e.local`,
      name: 'Timezone Edit GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Edit Timezone Game',
      play_days: [5, 6],
      timezone: 'America/Los_Angeles',
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}/edit`);

    // Wait for form to load
    await expect(page.getByRole('heading', { name: /edit game/i })).toBeVisible();

    // Change timezone to Chicago
    const timezoneSelect = page.locator('label:has-text("Timezone")').locator('..').locator('select');
    await timezoneSelect.selectOption('America/Chicago');

    // Save
    await page.getByRole('button', { name: /save changes/i }).click();

    // Should redirect to game page
    await expect(page).toHaveURL(`/games/${game.id}`);

    // Should see Chicago timezone
    await expect(page.getByText(/Chicago/)).toBeVisible();
  });

  test('calendar feed includes TZID when timezone is set', async ({ request }) => {
    const gm = await createTestUser(request, {
      email: `gm-tz-feed-${Date.now()}@e2e.local`,
      name: 'Timezone Feed GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Timezone Feed Campaign',
      play_days: [5, 6],
      default_start_time: '18:00',
      default_end_time: '22:00',
      timezone: 'America/New_York',
    });

    const playDates = getPlayDates([5, 6], 4);
    await createTestSession({
      game_id: game.id,
      date: playDates[0],
      confirmed_by: gm.id,
      start_time: '19:00',
      end_time: '23:00',
    });

    // Fetch the calendar feed
    const response = await request.get(`/api/games/calendar/${game.invite_code}`);

    expect(response.status()).toBe(200);

    const icsContent = await response.text();

    // Should include TZID parameter with the game's timezone
    expect(icsContent).toContain('TZID=America/New_York');
    expect(icsContent).toMatch(/DTSTART;TZID=America\/New_York:\d{8}T\d{6}/);
    expect(icsContent).toMatch(/DTEND;TZID=America\/New_York:\d{8}T\d{6}/);
  });
});
