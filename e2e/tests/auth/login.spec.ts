import { test, expect } from '@playwright/test';
import { loginTestUser } from '../../helpers/test-auth';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Authentication', () => {
  test('shows login page for unauthenticated users', async ({ page }) => {
    await page.goto('/login');

    // Should see login page elements
    await expect(page.getByRole('heading', { name: /can we play/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with discord/i })).toBeVisible();
  });

  test('redirects unauthenticated users from dashboard to login', async ({ page }) => {
    await page.goto('/dashboard');

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('authenticated user can access dashboard', async ({ page }) => {
    // Create and sign in a test user (automatically navigates to dashboard)
    await loginTestUser(page, {
      email: `auth-test-${Date.now()}@e2e.local`,
      name: 'Auth Test User',
      is_gm: false,
    });

    // Wait for dashboard content to load (includes client-side data fetch)
    await expect(page.getByRole('heading', { name: /your games/i })).toBeVisible({ timeout: TEST_TIMEOUTS.LONG });
  });

  test('authenticated user redirected from login to dashboard', async ({ page }) => {
    // Create and sign in a test user (don't navigate yet)
    await loginTestUser(page, {
      email: `auth-redirect-${Date.now()}@e2e.local`,
      name: 'Redirect Test User',
      is_gm: false,
    }, false);

    // Try to visit login page
    await page.goto('/login');

    // Should be redirected to dashboard (wait for auth to load and redirect)
    await expect(page).toHaveURL('/dashboard');
  });

  test('login respects callbackUrl parameter', async ({ page }) => {
    // Create and sign in a test user (don't navigate yet)
    await loginTestUser(page, {
      email: `callback-test-${Date.now()}@e2e.local`,
      name: 'Callback Test User',
      is_gm: false,
    }, false);

    // Visit login with callback URL
    await page.goto('/login?callbackUrl=/settings');

    // Should redirect to the callback URL (settings) - wait for auth + redirect
    await expect(page).toHaveURL('/settings');
  });

  // Note: "Create New Game" button tests removed - all users are now GMs by default

  test('user can sign out and session is properly cleared', async ({ page }) => {
    // Create and sign in a test user
    await loginTestUser(page, {
      email: `signout-test-${Date.now()}@e2e.local`,
      name: 'Sign Out User',
      is_gm: false,
    });

    // Verify we're on the dashboard
    await expect(page.getByRole('heading', { name: /your games/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Click sign out button
    await page.getByRole('button', { name: /sign out/i }).click();

    // Should be redirected to login page
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /can we play/i })).toBeVisible();

    // Verify session is cleared - protected routes should redirect to login
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login/);
  });
});
