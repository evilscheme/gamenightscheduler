import { test, expect } from '@playwright/test';
import { loginTestUser } from '../../helpers/test-auth';

test.describe('Campaign Dates', () => {
  test('GM can create a game with campaign dates', async ({ page }) => {
    await loginTestUser(page, {
      email: `gm-campaign-${Date.now()}@e2e.local`,
      name: 'Campaign GM',
      is_gm: true,
    });

    await page.goto('/games/new');
    await expect(
      page.getByRole('heading', { name: /create new game/i })
    ).toBeVisible();

    // Fill basic info
    await page.getByPlaceholder(/friday night board games/i).fill('Campaign Test');
    await page.getByRole('button', { name: 'Friday' }).click();

    // Set campaign dates
    await page.fill('#campaign-start', '2026-03-15');
    await page.fill('#campaign-end', '2026-08-31');

    // Submit
    await page.getByRole('button', { name: /create game/i }).click();
    await expect(page).toHaveURL(/\/games\/[a-f0-9-]+$/);

    // Verify dates show in game details
    // formatDisplayDate uses toLocaleDateString which is locale-dependent;
    // use regex to tolerate variations like "Mar 15, 2026" vs "15 Mar 2026"
    await expect(page.getByText(/Mar\s+15.+2026/)).toBeVisible();
    await expect(page.getByText(/Aug\s+31.+2026/)).toBeVisible();
  });

  test('GM can edit campaign dates', async ({ page }) => {
    await loginTestUser(page, {
      email: `gm-edit-campaign-${Date.now()}@e2e.local`,
      name: 'Edit Campaign GM',
      is_gm: true,
    });

    // Create a game first
    await page.goto('/games/new');
    await expect(
      page.getByRole('heading', { name: /create new game/i })
    ).toBeVisible();
    await page.getByPlaceholder(/friday night board games/i).fill('Edit Campaign Test');
    await page.getByRole('button', { name: 'Saturday' }).click();
    await page.getByRole('button', { name: /create game/i }).click();
    await expect(page).toHaveURL(/\/games\/[a-f0-9-]+$/);

    // Go to edit page via Edit button
    await page.getByRole('button', { name: /^edit$/i }).click();
    await expect(
      page.getByRole('heading', { name: /edit game/i })
    ).toBeVisible();

    // Set campaign dates
    await page.fill('#campaign-start', '2026-04-01');
    await page.fill('#campaign-end', '2026-09-30');

    // Save
    await page.getByRole('button', { name: /save changes/i }).click();

    // Should redirect back to game detail page
    await expect(page).toHaveURL(/\/games\/[a-f0-9-]+$/);

    // Verify dates show after save
    await expect(page.getByText(/Apr\s+1.+2026/)).toBeVisible();
    await expect(page.getByText(/Sep\s+30.+2026/)).toBeVisible();
  });

  test('expanded scheduling window options are available', async ({ page }) => {
    await loginTestUser(page, {
      email: `gm-window-opts-${Date.now()}@e2e.local`,
      name: 'Window Options GM',
      is_gm: true,
    });

    await page.goto('/games/new');
    await expect(
      page.getByRole('heading', { name: /create new game/i })
    ).toBeVisible();

    // Check that 6 and 12 month options exist in the scheduling window select
    const select = page.locator('#scheduling-window');
    await expect(select.locator('option[value="6"]')).toHaveText('6 months ahead');
    await expect(select.locator('option[value="12"]')).toHaveText('12 months ahead');
  });
});
