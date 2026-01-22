import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame, addPlayerToGame } from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

// Note: GM toggle test removed - all users are now GMs by default

test.describe('Settings Profile', () => {
  test('user can update display name', async ({ page, request }) => {
    const user = await createTestUser(request, {
      email: `user-name-${Date.now()}@e2e.local`,
      name: 'Original Name',
      is_gm: false,
    });

    await loginTestUser(page, {
      email: user.email,
      name: user.name,
      is_gm: false,
    });

    await page.goto('/settings');

    // Wait for settings page to load
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Find the display name input (use placeholder since label isn't properly associated)
    const nameInput = page.getByPlaceholder(/your name/i);
    await expect(nameInput).toBeVisible();

    // Wait for profile data to load - input should have the original name
    await expect(nameInput).toHaveValue('Original Name', { timeout: TEST_TIMEOUTS.DEFAULT });

    // Change the name
    await nameInput.fill('Updated Name');

    // Click save
    await page.getByRole('button', { name: /save changes/i }).click();

    // Should show success message
    await expect(page.getByText(/saved successfully/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });
  });

  test('name change persists after reload', async ({ page }) => {
    const timestamp = Date.now();
    const email = `user-persist-${timestamp}@e2e.local`;

    // First, create user with initial name
    await loginTestUser(page, {
      email,
      name: 'Before Change',
      is_gm: false,
    });

    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Wait for profile data to load
    const nameInput = page.getByPlaceholder(/your name/i);
    await expect(nameInput).toHaveValue('Before Change', { timeout: TEST_TIMEOUTS.DEFAULT });

    // Change name
    await nameInput.fill('After Change');
    await page.getByRole('button', { name: /save changes/i }).click();

    // Wait for save confirmation
    await expect(page.getByText(/saved successfully/i)).toBeVisible();

    // Verify persistence by logging in again (simulates returning to the app)
    // This avoids session issues with page.reload() or navigation
    await loginTestUser(page, {
      email,
      name: 'After Change', // loginTestUser won't override saved DB value
      is_gm: false,
    });

    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Verify name persisted in database
    await expect(page.getByPlaceholder(/your name/i)).toHaveValue('After Change', {
      timeout: TEST_TIMEOUTS.LONG,
    });
  });

  test('name change reflects in game member list', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-reflect-${Date.now()}@e2e.local`,
      name: 'Reflect GM',
      is_gm: true,
    });

    const player = await createTestUser(request, {
      email: `player-reflect-${Date.now()}@e2e.local`,
      name: 'Old Player Name',
      is_gm: false,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Reflect Campaign',
      play_days: [5, 6],
    });

    await addPlayerToGame(game.id, player.id);

    // Login as player
    await loginTestUser(page, {
      email: player.email,
      name: player.name,
      is_gm: false,
    });

    // Change name in settings
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Wait for profile data to load
    const nameInput = page.getByPlaceholder(/your name/i);
    await expect(nameInput).toHaveValue('Old Player Name', { timeout: TEST_TIMEOUTS.DEFAULT });

    await nameInput.fill('New Player Name');
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByText(/saved successfully/i)).toBeVisible();

    // Navigate to game page
    await page.goto(`/games/${game.id}`);

    // Should see new name in member list (look in the main content area, not nav)
    await expect(page.getByRole('list').getByText('New Player Name')).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
  });

});
