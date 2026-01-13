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
    await page.waitForLoadState('networkidle');

    // Should see the form
    await expect(page.getByRole('heading', { name: /create new game/i })).toBeVisible();

    // Fill out the form
    await page.getByLabel(/game name/i).fill('Test D&D Campaign');
    await page.getByPlaceholder(/brief description/i).fill('A test campaign for E2E testing');

    // Select Friday and Saturday as play days
    await page.getByRole('button', { name: 'Friday' }).click();
    await page.getByRole('button', { name: 'Saturday' }).click();

    // Submit the form
    await page.getByRole('button', { name: /create game/i }).click();

    // Should redirect to the game detail page
    await expect(page).toHaveURL(/\/games\/[a-f0-9-]+$/);

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

    // Try to navigate to create game page
    await page.goto('/games/new');
    await page.waitForLoadState('networkidle');

    // Should be redirected to dashboard
    await expect(page).toHaveURL('/dashboard');
  });

  test('shows validation error when no play days selected', async ({ page }) => {
    await loginTestUser(page, {
      email: `gm-validate-${Date.now()}@e2e.local`,
      name: 'Validation GM',
      is_gm: true,
    });

    await page.goto('/games/new');
    await page.waitForLoadState('networkidle');

    // Fill only the name
    await page.getByLabel(/game name/i).fill('Test Campaign');

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
    await page.waitForLoadState('networkidle');

    // Select play days but leave name empty
    await page.getByRole('button', { name: 'Friday' }).click();

    // Try to submit
    await page.getByRole('button', { name: /create game/i }).click();

    // Should show validation error
    await expect(page.getByText(/please enter a game name/i)).toBeVisible();
  });

  test('can select scheduling window', async ({ page }) => {
    await loginTestUser(page, {
      email: `gm-window-${Date.now()}@e2e.local`,
      name: 'Window GM',
      is_gm: true,
    });

    await page.goto('/games/new');
    await page.waitForLoadState('networkidle');

    // Change scheduling window to 3 months
    await page.getByRole('combobox').selectOption('3');

    // Fill required fields
    await page.getByLabel(/game name/i).fill('Long Window Campaign');
    await page.getByRole('button', { name: 'Friday' }).click();

    // Submit
    await page.getByRole('button', { name: /create game/i }).click();

    // Should redirect successfully
    await expect(page).toHaveURL(/\/games\/[a-f0-9-]+$/);
  });
});
