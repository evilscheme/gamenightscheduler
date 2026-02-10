import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame, addPlayerToGame } from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Navbar My Games link', () => {
  test('shows "My Games" in navbar when user has games as GM', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-nav-${Date.now()}@e2e.local`,
      name: 'Nav GM User',
      is_gm: true,
    });

    await createTestGame({
      gm_id: gm.id,
      name: 'Nav Test Game',
      play_days: [5, 6],
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /your games/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // "My Games" link should be visible in the navbar
    const nav = page.locator('nav');
    await expect(nav.getByRole('link', { name: 'My Games' })).toBeVisible();
  });

  test('shows "My Games" in navbar when user is a player in a game', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-owner-${Date.now()}@e2e.local`,
      name: 'Game Owner',
      is_gm: true,
    });

    const player = await createTestUser(request, {
      email: `player-nav-${Date.now()}@e2e.local`,
      name: 'Nav Player User',
      is_gm: false,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Player Nav Test Game',
      play_days: [5, 6],
    });

    await addPlayerToGame(game.id, player.id);

    await loginTestUser(page, {
      email: player.email,
      name: player.name,
      is_gm: false,
    });

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /your games/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // "My Games" link should be visible in the navbar
    const nav = page.locator('nav');
    await expect(nav.getByRole('link', { name: 'My Games' })).toBeVisible();
  });

  test('does not show "My Games" in navbar when user has no games', async ({ page, request }) => {
    const user = await createTestUser(request, {
      email: `user-nogames-${Date.now()}@e2e.local`,
      name: 'No Games User',
      is_gm: true,
    });

    await loginTestUser(page, {
      email: user.email,
      name: user.name,
      is_gm: true,
    });

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /your games/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // "My Games" link should NOT be in the navbar
    const nav = page.locator('nav');
    await expect(nav.getByRole('link', { name: 'My Games' })).not.toBeVisible();
  });

  test('"My Games" link navigates to dashboard', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-click-${Date.now()}@e2e.local`,
      name: 'Click Nav GM',
      is_gm: true,
    });

    await createTestGame({
      gm_id: gm.id,
      name: 'Click Nav Game',
      play_days: [5, 6],
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    // Start on a different page (settings)
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Click the "My Games" nav link
    const nav = page.locator('nav');
    await nav.getByRole('link', { name: 'My Games' }).click();

    // Should navigate to the dashboard
    await expect(page.getByRole('heading', { name: /your games/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
  });
});
