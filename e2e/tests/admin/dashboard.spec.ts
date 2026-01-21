import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame, addPlayerToGame, createTestSession } from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Admin Dashboard', () => {
  test('non-admin user is redirected to dashboard', async ({ page, request }) => {
    // Create a regular user (not admin)
    const user = await createTestUser(request, {
      email: `non-admin-${Date.now()}@e2e.local`,
      name: 'Non Admin User',
      is_gm: false,
      is_admin: false,
    });

    await loginTestUser(page, {
      email: user.email,
      name: user.name,
      is_gm: false,
      is_admin: false,
    });

    // Try to visit admin page
    await page.goto('/admin');

    // Should be redirected to dashboard
    await expect(page).toHaveURL('/dashboard', { timeout: TEST_TIMEOUTS.LONG });
  });

  test('admin user can access admin dashboard', async ({ page, request }) => {
    // Create an admin user
    const admin = await createTestUser(request, {
      email: `admin-access-${Date.now()}@e2e.local`,
      name: 'Admin User',
      is_gm: false,
      is_admin: true,
    });

    await loginTestUser(page, {
      email: admin.email,
      name: admin.name,
      is_gm: false,
      is_admin: true,
    });

    // Visit admin page
    await page.goto('/admin');

    // Should see admin dashboard heading
    await expect(page.getByRole('heading', { name: /admin dashboard/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Should see tabs
    await expect(page.getByRole('button', { name: /overview/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /games/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /activity/i })).toBeVisible();
  });

  test('admin link appears in navbar for admin users', async ({ page, request }) => {
    // Create an admin user
    const admin = await createTestUser(request, {
      email: `admin-nav-${Date.now()}@e2e.local`,
      name: 'Admin Nav User',
      is_gm: false,
      is_admin: true,
    });

    await loginTestUser(page, {
      email: admin.email,
      name: admin.name,
      is_gm: false,
      is_admin: true,
    });

    await page.goto('/dashboard');

    // Should see Admin link in navbar
    await expect(page.getByRole('link', { name: /^admin$/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
  });

  test('admin link does not appear for non-admin users', async ({ page, request }) => {
    // Create a regular user
    const user = await createTestUser(request, {
      email: `non-admin-nav-${Date.now()}@e2e.local`,
      name: 'Non Admin Nav User',
      is_gm: true, // GM but not admin
      is_admin: false,
    });

    await loginTestUser(page, {
      email: user.email,
      name: user.name,
      is_gm: true,
      is_admin: false,
    });

    await page.goto('/dashboard');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /your games/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Should NOT see Admin link in navbar
    await expect(page.getByRole('link', { name: /^admin$/i })).not.toBeVisible();
  });

  test('overview tab shows stats', async ({ page, request }) => {
    // Create an admin user
    const admin = await createTestUser(request, {
      email: `admin-stats-${Date.now()}@e2e.local`,
      name: 'Admin Stats User',
      is_gm: true,
      is_admin: true,
    });

    // Create a game and session to have some data
    const game = await createTestGame({
      gm_id: admin.id,
      name: 'Stats Test Game',
      play_days: [5, 6],
    });

    await createTestSession({
      game_id: game.id,
      date: '2025-06-15',
      confirmed_by: admin.id,
    });

    await loginTestUser(page, {
      email: admin.email,
      name: admin.name,
      is_gm: true,
      is_admin: true,
    });

    await page.goto('/admin');

    // Should be on Overview tab by default and see stats
    await expect(page.getByText(/total users/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await expect(page.getByText(/total games/i)).toBeVisible();
    await expect(page.getByText(/confirmed sessions/i)).toBeVisible();
  });

  test('games tab shows game list with metrics', async ({ page, request }) => {
    // Create an admin user
    const admin = await createTestUser(request, {
      email: `admin-games-${Date.now()}@e2e.local`,
      name: 'Admin Games User',
      is_gm: true,
      is_admin: true,
    });

    // Create a player
    const player = await createTestUser(request, {
      email: `player-games-${Date.now()}@e2e.local`,
      name: 'Test Player',
      is_gm: false,
      is_admin: false,
    });

    // Create a game
    const game = await createTestGame({
      gm_id: admin.id,
      name: 'Games Tab Test Campaign',
      play_days: [5, 6],
    });

    await addPlayerToGame(game.id, player.id);

    await loginTestUser(page, {
      email: admin.email,
      name: admin.name,
      is_gm: true,
      is_admin: true,
    });

    await page.goto('/admin');

    // Click Games tab
    await page.getByRole('button', { name: /games/i }).click();

    // Should see the game in the list
    await expect(page.getByText('Games Tab Test Campaign')).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Should see metric columns
    await expect(page.getByText(/players/i)).toBeVisible();
    await expect(page.getByText(/fill rate/i)).toBeVisible();
  });

  test('activity tab shows recent users and games', async ({ page, request }) => {
    // Create an admin user
    const admin = await createTestUser(request, {
      email: `admin-activity-${Date.now()}@e2e.local`,
      name: 'Admin Activity User',
      is_gm: true,
      is_admin: true,
    });

    // Create a game to show in recent games
    await createTestGame({
      gm_id: admin.id,
      name: 'Activity Test Game',
      play_days: [5, 6],
    });

    await loginTestUser(page, {
      email: admin.email,
      name: admin.name,
      is_gm: true,
      is_admin: true,
    });

    await page.goto('/admin');

    // Click Activity tab
    await page.getByRole('button', { name: /activity/i }).click();

    // Should see recent users and games sections
    await expect(page.getByRole('heading', { name: /recent users/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });
    await expect(page.getByRole('heading', { name: /recent games/i })).toBeVisible();

    // Should see the admin user in recent users (look within the Recent Users card)
    const recentUsersCard = page.locator('div').filter({ hasText: /^Recent Users/ }).first();
    await expect(recentUsersCard.getByText('Admin Activity User').first()).toBeVisible();

    // Should see the game in recent games (look within the Recent Games card)
    const recentGamesCard = page.locator('div').filter({ hasText: /^Recent Games/ }).first();
    await expect(recentGamesCard.getByText('Activity Test Game')).toBeVisible();
  });
});
