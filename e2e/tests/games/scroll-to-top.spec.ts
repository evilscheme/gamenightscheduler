import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame } from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Back to top', () => {
  test('appears deep in a long page and returns to the top', async ({ page, request }) => {
    await page.setViewportSize({ width: 380, height: 800 });

    const gm = await createTestUser(request, {
      email: `gm-scrolltop-${Date.now()}@e2e.local`,
      name: 'Scroll Top GM',
      is_gm: true,
    });

    // 12 months is the longest window the app offers, and AvailabilityCalendar
    // renders every month of it uncapped — so this page is reliably far taller
    // than the two-viewport threshold.
    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Scroll Top Campaign',
      play_days: [5, 6],
      scheduling_window_months: 12,
    });

    await loginTestUser(page, { email: gm.email, name: gm.name, is_gm: true });
    await page.goto(`/games/${game.id}`);

    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.locator('[data-testid="availability-tab-content"]')).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    const backToTop = page.getByRole('button', { name: 'Back to top' });

    // Precondition: without a genuinely tall page the rest of this passes vacuously.
    // Polled rather than read once — 13 full-size calendar months are still
    // painting immediately after the visibility wait above.
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollHeight > 3 * window.innerHeight)
      )
      .toBe(true);

    await expect(backToTop).toBeHidden();

    await page.evaluate(() => window.scrollTo(0, 3 * window.innerHeight));
    await expect(backToTop).toBeVisible();
    await expect(backToTop).toHaveAttribute('data-testid', 'scroll-to-top');

    await backToTop.click();

    // Smooth scrolling animates, so poll rather than reading once.
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(backToTop).toBeHidden();
  });
});
