import { test, expect } from '@playwright/test';
import { loginTestUser } from '../../helpers/test-auth';

/**
 * Returns a future date offset by the given number of months from today.
 * Returns { iso: "YYYY-MM-DD", pattern: RegExp } where the pattern matches
 * locale-dependent formatted output (e.g., "Mar 15, 2026" or "15 Mar 2026").
 */
function futureDate(monthsAhead: number, day: number = 15) {
  const date = new Date();
  date.setMonth(date.getMonth() + monthsAhead);
  date.setDate(day);

  const year = date.getFullYear();
  const month = date.getMonth();
  const d = date.getDate();

  const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const shortMonth = date.toLocaleDateString('en-US', { month: 'short' });
  // Match "Mar 15, 2026" or "15 Mar 2026" or similar locale variants
  const pattern = new RegExp(`(${shortMonth}\\s+${d}|${d}\\s+${shortMonth}).+${year}`);

  return { iso, pattern };
}

test.describe('Campaign Dates', () => {
  test('GM can create a game with campaign dates', async ({ page }) => {
    const startDate = futureDate(2, 15);
    const endDate = futureDate(7, 28);

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

    // Enable custom campaign date toggles, then fill dates
    await page.getByRole('switch', { name: /custom start date/i }).click();
    await page.fill('#campaign-start', startDate.iso);
    await page.getByRole('switch', { name: /custom end date/i }).click();
    await page.fill('#campaign-end', endDate.iso);

    // Submit
    await page.getByRole('button', { name: /create game/i }).click();
    await expect(page).toHaveURL(/\/games\/[a-f0-9-]+$/);

    // Verify dates show in game details
    await expect(page.getByText(startDate.pattern)).toBeVisible();
    await expect(page.getByText(endDate.pattern)).toBeVisible();
  });

  test('GM can edit campaign dates', async ({ page }) => {
    const startDate = futureDate(3, 1);
    const endDate = futureDate(8, 20);

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

    // Enable custom campaign date toggles, then fill dates
    await page.getByRole('switch', { name: /custom start date/i }).click();
    await page.fill('#campaign-start', startDate.iso);
    await page.getByRole('switch', { name: /custom end date/i }).click();
    await page.fill('#campaign-end', endDate.iso);

    // Save
    await page.getByRole('button', { name: /save changes/i }).click();

    // Should redirect back to game detail page
    await expect(page).toHaveURL(/\/games\/[a-f0-9-]+$/);

    // Verify dates show after save
    await expect(page.getByText(startDate.pattern)).toBeVisible();
    await expect(page.getByText(endDate.pattern)).toBeVisible();
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
