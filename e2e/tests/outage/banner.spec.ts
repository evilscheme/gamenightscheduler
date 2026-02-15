import { test, expect } from '../../fixtures/auth.fixture';
import { TEST_TIMEOUTS } from '../../constants';

/**
 * Tests that the outage banner appears when Supabase database queries
 * fail during normal navigation (not just on initial page load).
 *
 * Uses Playwright route interception to simulate a database outage
 * by returning 503 for Supabase REST API requests.
 */

// Run serially — these tests manipulate route interception which
// can interfere if tests share the same server setup phase.
test.describe.configure({ mode: 'serial' });

const bannerText = /having trouble connecting/i;

test.describe('Outage banner on database failure', () => {
  test('shows banner when Supabase REST API returns 503 during navigation', async ({
    gmPage,
    testGame,
  }) => {
    // Load dashboard successfully first (proves the app works before the outage)
    await gmPage.goto('/dashboard');
    await expect(gmPage.getByText(bannerText)).not.toBeVisible();

    // Simulate database outage: intercept REST API calls and return 503
    await gmPage.route('**/rest/v1/**', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Service Unavailable' }),
      }),
    );

    // Navigate to a page that makes database queries
    await gmPage.goto(`/games/${testGame.id}`);

    // The outage banner should appear
    await expect(gmPage.getByText(bannerText)).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });
  });

  test('banner disappears when database recovers', async ({
    gmPage,
    testGame,
  }) => {
    // Load dashboard first
    await gmPage.goto('/dashboard');

    // Simulate outage
    await gmPage.route('**/rest/v1/**', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Service Unavailable' }),
      }),
    );

    // Trigger the outage by navigating
    await gmPage.goto(`/games/${testGame.id}`);
    await expect(gmPage.getByText(bannerText)).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // "Recover" — stop intercepting so real requests succeed
    await gmPage.unroute('**/rest/v1/**');

    // Navigate to a page that makes successful queries
    await gmPage.goto('/dashboard');

    // Banner should disappear after successful queries
    await expect(gmPage.getByText(bannerText)).not.toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });
  });
});
