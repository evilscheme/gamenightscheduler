import { test, expect } from '@playwright/test';
import { loginTestUser } from '../../helpers/test-auth';

test.describe('Game Creation', () => {
  test('GM can create a new game', async ({ page }) => {
    // Create a GM user
    await loginTestUser(page, {
      email: `gm-create-${Date.now()}@e2e.local`,
      name: 'Game Creator GM',
      is_gm: true,
    });

    // Navigate to create game page
    await page.goto('/games/new');

    // Wait for form to load
    await expect(page.getByRole('heading', { name: /create new game/i })).toBeVisible();

    // Fill out the form
    await page.getByPlaceholder(/curse of strahd/i).fill('Test D&D Campaign');
    await page.getByPlaceholder(/brief description/i).fill('A test campaign for E2E testing');

    // Select Friday and Saturday as play days
    await page.getByRole('button', { name: 'Friday' }).click();
    await page.getByRole('button', { name: 'Saturday' }).click();

    // Submit the form
    await page.getByRole('button', { name: /create game/i }).click();

    // Should redirect to the game detail page
    await expect(page).toHaveURL(/\/games\/[a-f0-9-]+$/, );

    // Should see the game name
    await expect(page.getByRole('heading', { name: /test d&d campaign/i })).toBeVisible();
  });

  test('non-GM is redirected away from create game page', async ({ page }) => {
    // Create a non-GM user
    await loginTestUser(page, {
      email: `player-create-${Date.now()}@e2e.local`,
      name: 'Player User',
      is_gm: false,
    });

    // Try to navigate to create game page - will redirect non-GM to dashboard
    await page.goto('/games/new');

    // Should be redirected to dashboard (wait for auth/profile to load and redirect to trigger)
    await expect(page).toHaveURL('/dashboard', );
  });

  test('shows validation error when no play days selected', async ({ page }) => {
    await loginTestUser(page, {
      email: `gm-validate-${Date.now()}@e2e.local`,
      name: 'Validation GM',
      is_gm: true,
    });

    await page.goto('/games/new');

    // Wait for form to load
    await expect(page.getByRole('heading', { name: /create new game/i })).toBeVisible();

    // Fill only the name
    await page.getByPlaceholder(/curse of strahd/i).fill('Test Campaign');

    // Try to submit without selecting play days
    await page.getByRole('button', { name: /create game/i }).click();

    // Should show validation error
    await expect(page.getByText(/please select at least one play day/i)).toBeVisible();
  });

  test('shows validation error when name is empty', async ({ page }) => {
    await loginTestUser(page, {
      email: `gm-name-${Date.now()}@e2e.local`,
      name: 'Name Validation GM',
      is_gm: true,
    });

    await page.goto('/games/new');

    // Wait for form to load
    await expect(page.getByRole('heading', { name: /create new game/i })).toBeVisible();

    // Select play days but leave name empty
    await page.getByRole('button', { name: 'Friday' }).click();

    // Try to submit - browser's HTML5 validation will block submission
    await page.getByRole('button', { name: /create game/i }).click();

    // Should still be on the create page (form submission blocked by browser validation)
    await expect(page).toHaveURL('/games/new');
  });

  test('can select scheduling window', async ({ page }) => {
    await loginTestUser(page, {
      email: `gm-window-${Date.now()}@e2e.local`,
      name: 'Window GM',
      is_gm: true,
    });

    await page.goto('/games/new');

    // Wait for form to load
    await expect(page.getByRole('heading', { name: /create new game/i })).toBeVisible();

    // Change scheduling window to 3 months
    await page.getByRole('combobox').selectOption('3');

    // Fill required fields
    await page.getByPlaceholder(/curse of strahd/i).fill('Long Window Campaign');
    await page.getByRole('button', { name: 'Friday' }).click();

    // Submit
    await page.getByRole('button', { name: /create game/i }).click();

    // Should redirect successfully
    await expect(page).toHaveURL(/\/games\/[a-f0-9-]+$/, );
  });

  test('can set default session times', async ({ page }) => {
    await loginTestUser(page, {
      email: `gm-times-${Date.now()}@e2e.local`,
      name: 'Session Times GM',
      is_gm: true,
    });

    await page.goto('/games/new');

    // Wait for form to load
    await expect(page.getByRole('heading', { name: /create new game/i })).toBeVisible();

    // Fill required fields
    await page.getByPlaceholder(/curse of strahd/i).fill('Evening Campaign');
    await page.getByRole('button', { name: 'Saturday' }).click();

    // Set custom default times (7 PM - 11 PM)
    const startTimeInput = page.locator('input[type="time"]').first();
    const endTimeInput = page.locator('input[type="time"]').last();

    await startTimeInput.fill('19:00');
    await endTimeInput.fill('23:00');

    // Submit
    await page.getByRole('button', { name: /create game/i }).click();

    // Should redirect successfully
    await expect(page).toHaveURL(/\/games\/[a-f0-9-]+$/);

    // Should show the default times in game details
    await expect(page.getByText(/7:00 PM - 11:00 PM/)).toBeVisible();
  });

  test('default session times have sensible defaults', async ({ page }) => {
    await loginTestUser(page, {
      email: `gm-defaults-${Date.now()}@e2e.local`,
      name: 'Defaults GM',
      is_gm: true,
    });

    await page.goto('/games/new');

    // Wait for form to load
    await expect(page.getByRole('heading', { name: /create new game/i })).toBeVisible();

    // Check that time inputs have default values (6 PM - 10 PM / 18:00 - 22:00)
    const startTimeInput = page.locator('input[type="time"]').first();
    const endTimeInput = page.locator('input[type="time"]').last();

    await expect(startTimeInput).toHaveValue('18:00');
    await expect(endTimeInput).toHaveValue('22:00');
  });
});
