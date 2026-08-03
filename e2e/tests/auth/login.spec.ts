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

  // Supabase Auth sends provider failures back to /auth/callback as query
  // params rather than a code. Dropping them leaves the user bouncing off the
  // login page with no explanation — the failure mode a Discord account with
  // no email address hits every single time.
  test('explains a provider sign-in failure instead of silently returning to login', async ({ page }) => {
    await page.goto(
      '/auth/callback?provider=discord&error=server_error&error_code=unexpected_failure' +
        '&error_description=Error+getting+user+email+from+external+provider'
    );

    await expect(page).toHaveURL(/\/login\?error=provider_no_email&provider=discord/);
    await expect(page.getByText(/your discord account has no email address/i)).toBeVisible();
  });

  // The provider tag rides along on the callback URL we hand Supabase. If it
  // ever gets stripped, the message must stay neutral rather than blame a
  // provider the user did not use.
  test('stays provider-neutral when the callback is not tagged with a provider', async ({ page }) => {
    await page.goto(
      '/auth/callback?error=server_error' +
        '&error_description=Error+getting+user+email+from+external+provider'
    );

    await expect(page.getByText(/no email address/i)).toBeVisible();
    await expect(page.getByText(/your discord account/i)).toHaveCount(0);
  });

  test('keeps the intended destination when a provider sign-in fails', async ({ page }) => {
    await page.goto('/auth/callback?next=%2Fsettings&error=access_denied&error_description=denied');

    await expect(page).toHaveURL(/callbackUrl=%2Fsettings/);
    await expect(page.getByText(/sign-in was cancelled/i)).toBeVisible();
  });

  test('shows a generic message for an unrecognized sign-in error', async ({ page }) => {
    await page.goto('/login?error=auth_failed');

    await expect(page.getByText(/something went wrong while signing you in/i)).toBeVisible();
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
