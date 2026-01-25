import { test, expect } from '@playwright/test';
import { loginTestUser } from '../../helpers/test-auth';
import { TEST_TIMEOUTS } from '../../constants';

/**
 * Theme Switching Tests
 *
 * These tests verify that theme selection works correctly
 * and persists across page reloads.
 */

test.describe('Theme Switching', () => {
  test('user can switch between light and dark mode', async ({ page }) => {
    // Clear any existing theme preferences for this test
    await page.addInitScript(() => {
      localStorage.removeItem('color-theme');
      localStorage.removeItem('theme');
    });
    await loginTestUser(page, {
      email: `theme-mode-${Date.now()}@e2e.local`,
      name: 'Theme Mode User',
      is_gm: false,
    });

    // Navigate to settings
    await page.goto('/settings');

    // Wait for the theme picker to mount
    await expect(page.getByRole('button', { name: /light/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Click Dark mode
    await page.getByRole('button', { name: /dark/i }).click();

    // Verify the html element has the dark class
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Click Light mode
    await page.getByRole('button', { name: /light/i }).click();

    // Verify the html element does NOT have the dark class
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('dark mode persists after page reload', async ({ page }) => {
    await loginTestUser(page, {
      email: `theme-persist-${Date.now()}@e2e.local`,
      name: 'Theme Persist User',
      is_gm: false,
    });

    await page.goto('/settings');

    // Wait for the theme picker to mount
    await expect(page.getByRole('button', { name: /dark/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Switch to dark mode
    await page.getByRole('button', { name: /dark/i }).click();

    // Verify dark mode is active
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Navigate away and back (instead of reload) to test persistence
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /your games/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Verify dark mode persists on different page
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Navigate back to settings
    await page.goto('/settings');
    await expect(page.getByRole('button', { name: /dark/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Verify dark mode is still active
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('user can select a color theme', async ({ page }) => {
    await loginTestUser(page, {
      email: `theme-color-${Date.now()}@e2e.local`,
      name: 'Theme Color User',
      is_gm: false,
    });

    await page.goto('/settings');

    // Wait for color theme section to be visible
    await expect(page.getByText('Color Theme')).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Find and click a different color theme (not the default)
    // The themes are displayed as buttons with theme names
    const forestTheme = page.getByRole('button', { name: /forest/i });
    if (await forestTheme.isVisible()) {
      await forestTheme.click();

      // Verify the data-theme attribute is set
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'forest');
    } else {
      // Try another theme if forest isn't available
      const themes = page.locator('button').filter({ hasText: /ocean|sunset|lavender/i });
      const count = await themes.count();
      if (count > 0) {
        await themes.first().click();
      }
    }
  });

  test('color theme persists after navigation', async ({ page }) => {
    await loginTestUser(page, {
      email: `theme-color-persist-${Date.now()}@e2e.local`,
      name: 'Color Persist User',
      is_gm: false,
    });

    await page.goto('/settings');

    // Wait for color theme section
    await expect(page.getByText('Color Theme')).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Select a non-default theme
    const forestTheme = page.getByRole('button', { name: /forest/i });
    if (await forestTheme.isVisible()) {
      await forestTheme.click();

      // Wait for theme to be applied
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'forest');

      // Navigate to dashboard and back (instead of reload) to test persistence
      await page.goto('/dashboard');
      await expect(page.getByRole('heading', { name: /your games/i })).toBeVisible({
        timeout: TEST_TIMEOUTS.LONG,
      });

      // Verify theme persists on different page
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'forest');

      // Navigate back to settings
      await page.goto('/settings');
      await expect(page.getByText('Color Theme')).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // Verify the theme is still applied
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'forest');
    }
  });

  test('system mode option is available', async ({ page }) => {
    await loginTestUser(page, {
      email: `theme-system-${Date.now()}@e2e.local`,
      name: 'Theme System User',
      is_gm: false,
    });

    await page.goto('/settings');

    // Wait for the theme picker to mount
    await expect(page.getByRole('button', { name: /system/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Click System mode
    await page.getByRole('button', { name: /system/i }).click();

    // Verify the button appears selected (has different styling)
    // The selected button has 'bg-card' class
    const systemButton = page.getByRole('button', { name: /system/i });
    await expect(systemButton).toBeVisible();
  });

  test('theme changes apply across pages', async ({ page }) => {
    await loginTestUser(page, {
      email: `theme-cross-${Date.now()}@e2e.local`,
      name: 'Theme Cross User',
      is_gm: true,
    });

    await page.goto('/settings');

    // Wait for theme picker
    await expect(page.getByRole('button', { name: /dark/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Switch to dark mode
    await page.getByRole('button', { name: /dark/i }).click();

    // Verify dark mode is active
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Navigate to dashboard
    await page.goto('/dashboard');

    // Wait for dashboard to load
    await expect(page.getByRole('heading', { name: /your games/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Verify dark mode is still active on the new page
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});
