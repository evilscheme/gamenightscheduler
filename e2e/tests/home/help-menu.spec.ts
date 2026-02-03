import { test, expect } from '@playwright/test';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Help Menu', () => {
  test('help dropdown shows bug report and feedback links', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Click help menu button
    await page.getByRole('button', { name: 'Help menu' }).click();

    // Report Bug link should be visible with correct href
    const bugLink = page.getByRole('link', { name: 'Report Bug' });
    await expect(bugLink).toBeVisible();
    await expect(bugLink).toHaveAttribute(
      'href',
      'https://github.com/evilscheme/gamenightscheduler/issues'
    );

    // Send Feedback link should be visible with mailto href
    const feedbackLink = page.getByRole('link', { name: 'Send Feedback' });
    await expect(feedbackLink).toBeVisible();
    await expect(feedbackLink).toHaveAttribute('href', /^mailto:/);
  });

  test('help menu closes when clicking outside', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Open help menu
    await page.getByRole('button', { name: 'Help menu' }).click();
    await expect(page.getByRole('link', { name: 'Report Bug' })).toBeVisible();

    // Click outside the menu (on the page body)
    await page.locator('main').click();

    // Menu should close
    await expect(page.getByRole('link', { name: 'Report Bug' })).not.toBeVisible();
  });
});
