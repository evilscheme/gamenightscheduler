import { test, expect } from '@playwright/test';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Landing Page', () => {
  test('landing page renders for anonymous user', async ({ page }) => {
    await page.goto('/');

    // Hero section should be visible - wait for heading to appear
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Tagline should be visible
    await expect(page.getByText(/never miss a game night again/i)).toBeVisible();

    // Description text should be visible
    await expect(page.getByText(/coordinate your d&d/i)).toBeVisible();

    // CTA buttons should be visible
    await expect(page.getByRole('link', { name: /get started/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /learn more/i })).toBeVisible();

    // Features section should be visible
    await expect(page.getByRole('heading', { name: /everything you need/i })).toBeVisible();

    // Feature cards should be present (use headings to be specific)
    await expect(page.getByRole('heading', { name: 'Track Availability' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Smart Suggestions' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Calendar Export' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Multiple Campaigns' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Easy Invites' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Flexible Play Days' })).toBeVisible();

    // Bottom CTA should be visible
    await expect(page.getByRole('heading', { name: /ready to roll initiative/i })).toBeVisible();
  });

  test('CTA button navigates to login', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Click "Get Started" button
    await page.getByRole('link', { name: /get started/i }).click();

    // Should navigate to login page
    await expect(page).toHaveURL('/login');

    // Login page should show sign in options
    await expect(page.getByText(/sign in/i).first()).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });
  });
});
