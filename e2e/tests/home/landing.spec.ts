import { test, expect } from '@playwright/test';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Landing Page', () => {
  test('landing page renders for anonymous user', async ({ page }) => {
    await page.goto('/');

    // Hero section should be visible - wait for heading to appear
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Subtitle should be visible
    await expect(page.getByText(/track availability/i)).toBeVisible();

    // CTA buttons should be visible
    await expect(page.getByRole('link', { name: /get started/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /see how it works/i })).toBeVisible();

    // "How it works" section should be visible
    await expect(page.getByRole('heading', { name: /how it works/i })).toBeVisible();

    // Steps should be present
    await expect(page.getByRole('heading', { name: 'Invite your party' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mark availability' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Book game nights' })).toBeVisible();

    // Features should be present
    await expect(page.getByRole('heading', { name: 'Multi-Game' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Calendar Sync' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Co-GM Support' })).toBeVisible();
  });

  test('CTA button navigates to login', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Click first "Get Started" button (hero CTA)
    await page.getByRole('link', { name: /get started/i }).first().click();

    // Should navigate to login page
    await expect(page).toHaveURL('/login');

    // Login page should show sign in options
    await expect(page.getByText(/sign in/i).first()).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });
  });
});
